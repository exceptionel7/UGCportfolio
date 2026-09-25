import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";

/**
 * Payment core (Step 3). Shared, IDEMPOTENT settlement logic used by BOTH:
 *   - the Stripe webhook  (primary path)
 *   - admin/server reconcile (recovery path when a webhook is lost)
 * Using one code path guarantees both routes behave identically.
 *
 * INVARIANTS
 *  - `PAID` is written ONLY here (called from the webhook/reconcile), never from
 *    a client, a brand action, or an admin "mark paid" button (none exists).
 *  - Amount + currency are re-verified against Stripe before marking paid.
 *  - feeCents + netCents === grossCents (integer cents, floor on fee).
 *  - Earning creation is exactly-once (Earning.campaignId @unique).
 *  - Refunds/disputes are recorded for admin review and NEVER silently change earnings.
 */

// Prisma transaction client type (interactive $transaction callback arg)
export type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

/**
 * Pure predicate — may this campaign be funded?
 *
 *   • COMPLETED            ⇒ no (terminal state, closed to new funding)
 *   • no selected creator  ⇒ no (Decision #4 Option B — money needs a payee)
 *   • no positive budget   ⇒ no (amount always comes from the DB)
 *
 * Single definition, used by BOTH the server action (authoritative) and the UI
 * (presentation), so they can never disagree.
 */
export function isCampaignFundable(args: {
  status: string;
  selectedCreatorId?: string | null;
  budgetCents?: number | null;
}): { ok: boolean; reason?: "COMPLETED" | "NO_CREATOR" | "NO_BUDGET" } {
  if (args.status === "COMPLETED") return { ok: false, reason: "COMPLETED" };
  if (!args.selectedCreatorId) return { ok: false, reason: "NO_CREATOR" };
  if (!args.budgetCents || args.budgetCents <= 0) return { ok: false, reason: "NO_BUDGET" };
  return { ok: true };
}

/** Human-readable reason, shared by the action's error and the UI copy. */
export const FUNDING_BLOCKED_MESSAGE: Record<"COMPLETED" | "NO_CREATOR" | "NO_BUDGET", string> = {
  COMPLETED: "This campaign is completed and can no longer be funded.",
  NO_CREATOR: "Select a creator before funding this campaign.",
  NO_BUDGET: "Set a campaign budget before funding.",
};

/**
 * Pure predicate — may the selected creator still be changed?
 *
 * LOCKED once funding is in progress or complete, or once an Earning exists:
 *   • Earning exists            ⇒ locked (payee already bound)
 *   • Payment PROCESSING | PAID ⇒ locked (funding in flight or settled)
 * UNLOCKED (re-selection allowed) when there is no Earning and:
 *   • no Payment row, or
 *   • Payment PENDING | FAILED | CANCELED (no funding in flight)
 *
 * Kept as a single exported function so the rule has exactly one definition.
 */
export function isCreatorChangeLocked(args: { paymentStatus?: string | null; earningExists: boolean }): boolean {
  if (args.earningExists) return true;
  return args.paymentStatus === "PROCESSING" || args.paymentStatus === "PAID";
}

/** Integer-cents fee split. feeCents + netCents === grossCents, always. */
export function feeSplit(grossCents: number, feeBps: number) {
  const feeCents = Math.floor((grossCents * feeBps) / 10000);
  const netCents = grossCents - feeCents;
  return { feeCents, netCents };
}

export async function getPlatformSetting() {
  return prisma.platformSetting.upsert({ where: { id: "singleton" }, update: {}, create: {} });
}

/** Normalized shape extracted from either a Checkout Session or a PaymentIntent. */
export type SettleInput = {
  paymentId?: string | null;
  campaignId?: string | null;
  amountCents: number | null;
  currency: string | null;
  paymentIntentId: string | null;
  chargeId: string | null;
  sourceEventId?: string;
};

function asId(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (typeof v === "object" && v && "id" in v) return String((v as { id: string }).id);
  return null;
}

/** Extract a normalized SettleInput from a Stripe event object. */
export function extractSettleInput(event: Stripe.Event): SettleInput | null {
  // NOTE: event.data.object is a very large Stripe union. Casting it to
  // Record<string, unknown> is rejected by TS (no index signature on members
  // like ReceivedDebit), so each branch casts via `unknown` after narrowing on
  // event.type — which is the discriminant that actually guarantees the shape.
  if (event.type === "checkout.session.completed") {
    const s = event.data.object as unknown as Stripe.Checkout.Session;
    if (s.payment_status !== "paid") return null; // only settle truly paid sessions
    return {
      paymentId: s.metadata?.paymentId ?? null,
      campaignId: s.metadata?.campaignId ?? null,
      amountCents: s.amount_total ?? null,
      currency: s.currency ?? null,
      paymentIntentId: asId(s.payment_intent),
      chargeId: null,
      sourceEventId: event.id,
    };
  }
  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as unknown as Stripe.PaymentIntent;
    return {
      paymentId: pi.metadata?.paymentId ?? null,
      campaignId: pi.metadata?.campaignId ?? null,
      amountCents: pi.amount_received ?? pi.amount ?? null,
      currency: pi.currency ?? null,
      paymentIntentId: pi.id,
      chargeId: asId((pi as unknown as { latest_charge?: unknown }).latest_charge),
      sourceEventId: event.id,
    };
  }
  return null;
}

/**
 * Mark a campaign payment PAID and create the creator Earning — idempotent.
 * MUST be called inside a transaction (tx) together with the WebhookEvent insert
 * so that a failure rolls back BOTH (letting Stripe retry safely).
 */
export async function settleCampaignPayment(tx: Tx, input: SettleInput): Promise<{ ok: boolean; reason?: string }> {
  // Locate the payment: prefer metadata id, fall back to the PaymentIntent id.
  const payment =
    (input.paymentId ? await tx.payment.findUnique({ where: { id: input.paymentId } }) : null) ??
    (input.paymentIntentId ? await tx.payment.findUnique({ where: { stripePaymentIntentId: input.paymentIntentId } }) : null);

  if (!payment) {
    // Orphan: Stripe charged something we cannot map. Record + alert; retrying won't help.
    await alertAdmins(tx, "payment_orphan", `Stripe payment with no local record (event ${input.sourceEventId ?? "?"}, pi ${input.paymentIntentId ?? "?"}).`);
    return { ok: false, reason: "ORPHAN" };
  }

  // --- Verify against Stripe. Never trust our own expectation blindly. ---
  if (input.amountCents == null || input.currency == null) return { ok: false, reason: "INCOMPLETE_EVENT" };
  const sameAmount = input.amountCents === payment.amountCents;
  const sameCurrency = input.currency.toLowerCase() === payment.currency.toLowerCase();
  if (!sameAmount || !sameCurrency) {
    const reason = `AMOUNT_MISMATCH stripe=${input.amountCents}${input.currency} db=${payment.amountCents}${payment.currency}`;
    await tx.payment.update({ where: { id: payment.id }, data: { failureReason: reason } });
    await alertAdmins(tx, "payment_mismatch", `Payment ${payment.id}: ${reason}. NOT marked paid.`);
    return { ok: false, reason }; // deliberately NOT marked paid
  }

  // --- Duplicate/overpayment guard: a DIFFERENT PaymentIntent on an already-paid campaign ---
  if (payment.status === "PAID" && payment.stripePaymentIntentId && input.paymentIntentId && payment.stripePaymentIntentId !== input.paymentIntentId) {
    // Prisma JsonValue is also a union (string | number | boolean | object | null),
    // so cast via `unknown` for the same reason as the Stripe casts above.
    const meta = (payment.metadata as unknown as Record<string, unknown> | null) ?? {};
    const dupes = Array.isArray(meta.duplicateCharges) ? (meta.duplicateCharges as string[]) : [];
    if (!dupes.includes(input.paymentIntentId)) dupes.push(input.paymentIntentId);
    await tx.payment.update({ where: { id: payment.id }, data: { metadata: { ...meta, duplicateCharges: dupes } } });
    await alertAdmins(tx, "duplicate_charge", `Campaign payment ${payment.id} received a second charge (${input.paymentIntentId}). Manual refund required. No second earning created.`);
    return { ok: false, reason: "DUPLICATE_CHARGE" };
  }

  // --- Idempotent state transition (no-op if already PAID) ---
  await tx.payment.updateMany({
    where: { id: payment.id, status: { not: "PAID" } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      stripePaymentIntentId: input.paymentIntentId ?? payment.stripePaymentIntentId,
      stripeChargeId: input.chargeId ?? payment.stripeChargeId,
      failureReason: null,
    },
  });

  // --- Creator earning (exactly-once) ---
  const campaignId = payment.campaignId ?? input.campaignId ?? null;
  if (campaignId) await ensureEarning(tx, campaignId);

  // Notify the paying brand — via tx so it rolls back with the rest.
  if (payment.userId) {
    await tx.notification.create({
      data: { userId: payment.userId, type: "payment_received", body: "Payment received for your campaign. Funds are recorded." },
    });
  }
  return { ok: true };
}

/**
 * Create the Earning for a funded campaign if (a) the payment is PAID and
 * (b) a creator is selected. Safe to call repeatedly — unique constraint makes
 * it exactly-once. Called from settlement AND from creator selection, so
 * funding-before-selection and selection-before-funding both work.
 */
export async function ensureEarning(tx: Tx, campaignId: string): Promise<void> {
  const campaign = await tx.campaign.findUnique({ where: { id: campaignId }, include: { payment: true } });
  if (!campaign?.payment || campaign.payment.status !== "PAID") return; // no payment ⇒ no earning, ever
  // Under Decision #4 Option B funding requires a selected creator, so this is
  // defence-in-depth rather than a load-bearing path (it also keeps the function
  // correct if the rule is ever relaxed to allow pre-funding).
  if (!campaign.selectedCreatorId) return;

  const gross = campaign.payment.amountCents;
  const feeBps = campaign.payment.platformFeeBps ?? (await tx.platformSetting.findUnique({ where: { id: "singleton" } }))?.platformFeeBps ?? 1500;
  const { feeCents, netCents } = feeSplit(gross, feeBps);

  try {
    await tx.earning.create({
      data: {
        campaignId,
        creatorId: campaign.selectedCreatorId,
        paymentId: campaign.payment.id,
        grossCents: gross,
        feeBps,
        feeCents,
        netCents,
        status: "PENDING", // becomes ELIGIBLE only on completion (a later, separate step)
      },
    });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e; // already created by an earlier event — fine
  }
}

/** payment_intent.payment_failed */
export async function markPaymentFailed(tx: Tx, event: Stripe.Event): Promise<void> {
  const pi = event.data.object as unknown as Stripe.PaymentIntent;
  const id = pi.metadata?.paymentId ?? null;
  const payment =
    (id ? await tx.payment.findUnique({ where: { id } }) : null) ??
    (await tx.payment.findUnique({ where: { stripePaymentIntentId: pi.id } }).catch(() => null));
  if (!payment || payment.status === "PAID") return; // never downgrade a paid payment
  await tx.payment.update({
    where: { id: payment.id },
    data: { status: "FAILED", failureReason: pi.last_payment_error?.message ?? "payment_failed", stripePaymentIntentId: pi.id },
  });
}

/**
 * charge.refunded / charge.dispute.created — RECORD ONLY.
 * Per business rule: refunds must not silently create or destroy creator earnings.
 * We flag requiresAdminReview and leave earnings untouched.
 */
export async function recordRefundForReview(tx: Tx, event: Stripe.Event): Promise<void> {
  const charge = event.data.object as unknown as Stripe.Charge;
  const paymentIntentId = asId(charge.payment_intent);
  const payment = paymentIntentId ? await tx.payment.findUnique({ where: { stripePaymentIntentId: paymentIntentId } }) : null;
  if (!payment) {
    await alertAdmins(tx, "refund_orphan", `Refund/dispute for unknown payment (pi ${paymentIntentId ?? "?"}).`);
    return;
  }

  if (event.type === "charge.dispute.created") {
    await alertAdmins(tx, "dispute", `Dispute opened on payment ${payment.id}. Manual review required. Earnings unchanged.`);
    return;
  }

  const refunded = charge.amount_refunded ?? 0;
  const fully = refunded >= charge.amount;
  for (const r of charge.refunds?.data ?? []) {
    try {
      await tx.refund.create({
        data: { paymentId: payment.id, amountCents: r.amount, stripeRefundId: r.id, reason: r.reason ?? null, status: "SUCCEEDED", requiresAdminReview: true },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e; // already recorded
    }
  }
  await tx.payment.update({
    where: { id: payment.id },
    data: { refundedCents: refunded, status: fully ? "REFUNDED" : "PARTIALLY_REFUNDED" },
  });
  await alertAdmins(tx, "refund", `Payment ${payment.id} refunded ${refunded} cents (${fully ? "full" : "partial"}). Creator earnings NOT auto-adjusted — admin review required.`);
}

/** In-app admin alert (email remains NOT CONNECTED). */
async function alertAdmins(tx: Tx, type: string, body: string): Promise<void> {
  const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const a of admins) await tx.notification.create({ data: { userId: a.id, type, body } });
  if (admins.length === 0) console.warn(`[payments:${type}] ${body}`);
}
