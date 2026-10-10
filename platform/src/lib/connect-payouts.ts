import "server-only";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { requireAdmin } from "@/lib/guards";
import { sumNetCents, type Tx } from "@/lib/payments";
import {
  isConnectEnabled,
  getCreatorPayoutReadiness,
  CONNECT_NOT_ENABLED,
  CONNECT_UNAVAILABLE_MESSAGE,
  CREATOR_PAYOUT_ACCOUNT_NOT_READY,
} from "@/lib/connect";

/**
 * REAL creator payouts: platform balance → connected account, via Stripe Transfer.
 *
 * THE INVARIANT (mirrors payment settlement exactly):
 *   The server action may only move PENDING → PROCESSING.
 *   Only a VERIFIED transfer.created webhook may move PROCESSING → PAID.
 * Nothing in this file marks a payout PAID after calling Stripe.
 *
 * "transfer.created" means the platform created a transfer to the connected
 * account. It does NOT mean the creator's bank has the money — that would be a
 * later connected-account payout event, which this integration does not claim.
 *
 * DUPLICATE-TRANSFER DEFENCE, four layers:
 *   L1 guarded reserve  — PENDING → PROCESSING only; 0 rows ⇒ someone else owns it
 *   L2 stripeTransferId — non-null ⇒ never transfer again (DB @unique backs this)
 *   L3 idempotency key  — payout_transfer_<id>, stable across every retry, so
 *                         Stripe returns the ORIGINAL transfer instead of a new one
 *   L4 webhook guards   — settlement is a guarded updateMany, so replays no-op
 */

/** §19 — stable across browser retry, server retry, timeout, redeploy. */
export function payoutTransferIdempotencyKey(payoutId: string): string {
  return `payout_transfer_${payoutId}`;
}

export type PayoutTransferAction = "TRANSFER" | "RECOVER" | "AWAIT_WEBHOOK" | "ALREADY_SETTLED" | "BLOCKED";

/**
 * PURE decision: what should happen to this payout?
 *
 *   PAID                              ⇒ ALREADY_SETTLED (nothing to do)
 *   stripeTransferId present          ⇒ AWAIT_WEBHOOK  (never a second transfer)
 *   PROCESSING without a transfer id  ⇒ RECOVER        (crash case: retry with the
 *                                       SAME idempotency key and let Stripe decide)
 *   PENDING                           ⇒ TRANSFER
 *   anything else                     ⇒ BLOCKED
 *
 * The transfer-id check precedes the status checks deliberately: a stored id is
 * the strongest evidence money already moved.
 */
export function classifyPayoutForTransfer(payout: {
  status: string;
  stripeTransferId?: string | null;
  amountCents: number;
}): { action: PayoutTransferAction; reason?: string } {
  if (!Number.isInteger(payout.amountCents) || payout.amountCents <= 0) {
    return { action: "BLOCKED", reason: "INVALID_AMOUNT" };
  }
  if (payout.status === "PAID") return { action: "ALREADY_SETTLED" };
  if (payout.stripeTransferId) return { action: "AWAIT_WEBHOOK" };
  if (payout.status === "PROCESSING") return { action: "RECOVER" };
  if (payout.status === "PENDING") return { action: "TRANSFER" };
  return { action: "BLOCKED", reason: `PAYOUT_STATUS_${payout.status}` };
}

/**
 * PURE classification of a Stripe failure.
 *
 * `definitive: true` means Stripe REJECTED the request, so no transfer exists and
 * it is safe to fail the payout and release the earnings.
 *
 * `definitive: false` means we do not know whether Stripe created the transfer
 * (connection dropped, timeout, 5xx). §31: never blindly mark FAILED and retry
 * with a new transfer — leave it PROCESSING for reconciliation, which is safe
 * because the idempotency key makes a later retry return the original transfer.
 */
export function classifyTransferError(err: unknown): { definitive: boolean; code: string; safeMessage: string } {
  const e = (err ?? {}) as { type?: string; code?: string; message?: string };
  const type = e.type ?? "";
  const code = e.code ?? "";

  if (code === "balance_insufficient") {
    return {
      definitive: true,
      code: "BALANCE_INSUFFICIENT",
      safeMessage: "Platform balance is too low to send this payout.",
    };
  }

  // Request-level rejections: Stripe never created a transfer.
  if (
    type === "StripeInvalidRequestError" ||
    type === "StripePermissionError" ||
    type === "StripeAuthenticationError" ||
    type === "StripeIdempotencyError"
  ) {
    return {
      definitive: true,
      code: code ? `STRIPE_REJECTED_${code.toUpperCase()}` : "STRIPE_REJECTED",
      safeMessage: "Stripe rejected this transfer. Check the creator's payout account and the platform balance.",
    };
  }

  // Connection/rate/unknown — outcome genuinely unknown.
  return {
    definitive: false,
    code: "TRANSFER_OUTCOME_UNCONFIRMED",
    safeMessage: "Transfer outcome could not be confirmed. It will be reconciled with Stripe before any retry.",
  };
}

/** Fail a payout and return its earnings to the eligible pool (PR #3 recovery semantics). */
async function failPayoutAndRelease(payoutId: string, reason: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.payout.updateMany({
      where: { id: payoutId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "FAILED", failureReason: reason.slice(0, 500) },
    });
    if (count === 0) return false;
    await tx.earning.updateMany({ where: { payoutId, status: "ELIGIBLE" }, data: { payoutId: null } });
    return true;
  });
}

export type TransferPayoutResult = {
  ok: boolean;
  status:
    | "TRANSFER_CREATED"
    | "AWAITING_WEBHOOK"
    | "ALREADY_SETTLED"
    | "NOT_READY"
    | "BLOCKED"
    | "FAILED"
    | "NEEDS_RECONCILIATION";
  code?: string;
  message?: string;
  transferId?: string | null;
};

/**
 * Initiate the real Stripe Transfer for a payout. ADMIN only.
 * Returns a structured result; never throws raw Stripe errors at the UI.
 */
export async function transferPayout(payoutId: string): Promise<TransferPayoutResult> {
  await requireAdmin(); // §28 — admins only, checked in the action itself

  if (!isConnectEnabled()) {
    return { ok: false, status: "BLOCKED", code: CONNECT_NOT_ENABLED, message: CONNECT_UNAVAILABLE_MESSAGE };
  }
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, status: "BLOCKED", code: CONNECT_NOT_ENABLED, message: CONNECT_UNAVAILABLE_MESSAGE };
  }

  const payout = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { earnings: { select: { id: true, status: true, netCents: true } } },
  });
  if (!payout) return { ok: false, status: "BLOCKED", code: "PAYOUT_NOT_FOUND", message: "Payout not found." };

  const decision = classifyPayoutForTransfer(payout);
  if (decision.action === "ALREADY_SETTLED") {
    return { ok: true, status: "ALREADY_SETTLED", transferId: payout.stripeTransferId, message: "Payout already settled." };
  }
  if (decision.action === "AWAIT_WEBHOOK") {
    // §20/§32 — a transfer already exists for this payout. Never create another.
    return {
      ok: true,
      status: "AWAITING_WEBHOOK",
      transferId: payout.stripeTransferId,
      message: "Transfer already sent — awaiting Stripe confirmation.",
    };
  }
  if (decision.action === "BLOCKED") {
    return { ok: false, status: "BLOCKED", code: decision.reason, message: "This payout cannot be transferred." };
  }

  // ---- §14 ledger gate: the earnings must really belong here and be payable ----
  if (payout.earnings.length === 0) {
    return { ok: false, status: "BLOCKED", code: "NO_EARNINGS", message: "This payout has no earnings attached." };
  }
  if (payout.earnings.some((e) => e.status !== "ELIGIBLE")) {
    return { ok: false, status: "BLOCKED", code: "EARNING_NOT_ELIGIBLE", message: "An attached earning is not eligible." };
  }
  // §18 — the ledger is authoritative. The fee is NEVER recomputed here.
  if (sumNetCents(payout.earnings) !== payout.amountCents) {
    return { ok: false, status: "BLOCKED", code: "AMOUNT_MISMATCH", message: "Payout amount does not match its earnings." };
  }

  // ---- §10/§14 readiness, from LIVE Stripe state (not the cached flag) ----
  const readiness = await getCreatorPayoutReadiness(payout.creatorId);
  if (!readiness.ok || !readiness.accountId) {
    return {
      ok: false,
      status: "NOT_READY",
      code: CREATOR_PAYOUT_ACCOUNT_NOT_READY,
      message: "This creator has not completed Stripe payout onboarding.",
    };
  }

  // ---- §16 RESERVE BEFORE STRIPE (only on the fresh PENDING path) ----
  if (decision.action === "TRANSFER") {
    const { count } = await prisma.payout.updateMany({
      where: { id: payoutId, status: "PENDING" }, // guarded in SQL
      data: { status: "PROCESSING", failureReason: null },
    });
    if (count === 0) {
      // Another administrator reserved it between our read and this update.
      return { ok: false, status: "BLOCKED", code: "ALREADY_RESERVED", message: "Another administrator is already processing this payout." };
    }
  }

  // ---- §17/§19 the transfer itself ----
  let transferId: string;
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: payout.amountCents, // §18 stored creator net — never recalculated
        currency: payout.currency, // §29 no conversion, ever
        destination: readiness.accountId,
        description: `Exceptionel creator payout ${payout.id}`,
        metadata: {
          payoutId: payout.id,
          creatorId: payout.creatorId,
          earningCount: String(payout.earnings.length),
          earningIds: payout.earnings.map((e) => e.id).join(",").slice(0, 450),
        },
      },
      { idempotencyKey: payoutTransferIdempotencyKey(payout.id) },
    );
    transferId = transfer.id;
  } catch (err) {
    const classified = classifyTransferError(err);
    if (classified.definitive) {
      await failPayoutAndRelease(payoutId, `${classified.code}: ${classified.safeMessage}`);
      return { ok: false, status: "FAILED", code: classified.code, message: classified.safeMessage };
    }
    // §31 — outcome unknown. Stay PROCESSING; do NOT release, do NOT retry blindly.
    await prisma.payout.updateMany({
      where: { id: payoutId, status: "PROCESSING" },
      data: { failureReason: `${classified.code}: awaiting reconciliation with Stripe.` },
    });
    return { ok: false, status: "NEEDS_RECONCILIATION", code: classified.code, message: classified.safeMessage };
  }

  // Record the transfer id. Guarded so a concurrent recovery cannot overwrite it.
  // Status stays PROCESSING — ONLY the webhook may mark PAID (§33).
  await prisma.payout.updateMany({
    where: { id: payoutId, stripeTransferId: null },
    data: { stripeTransferId: transferId, failureReason: null },
  });

  return { ok: true, status: "TRANSFER_CREATED", transferId, message: "Transfer sent — awaiting Stripe confirmation." };
}

/* ======================================================================
 * WEBHOOK SETTLEMENT — runs inside the existing webhook transaction so it
 * shares the WebhookEvent idempotency guard (no second event table).
 * ====================================================================== */

/** Normalized fields we need off a Stripe Transfer. */
export type TransferShape = {
  id: string;
  amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
};

/**
 * §21 transfer.created ⇒ Payout PROCESSING → PAID, Earnings ELIGIBLE → PAID.
 *
 * Idempotent by construction: both writes are guarded updateMany calls, so a
 * duplicate delivery changes nothing. The payout is resolved ONLY from the
 * verified Stripe payload (transfer id first, then our own metadata).
 */
export async function settleTransferCreated(tx: Tx, transfer: TransferShape): Promise<{ ok: boolean; reason?: string }> {
  const byTransfer = await tx.payout.findFirst({ where: { stripeTransferId: transfer.id } });
  const metaPayoutId = transfer.metadata?.payoutId ?? null;
  const payout = byTransfer ?? (metaPayoutId ? await tx.payout.findUnique({ where: { id: metaPayoutId } }) : null);

  if (!payout) {
    console.warn(`[connect:transfer.created] no payout for transfer ${transfer.id}`);
    return { ok: false, reason: "NO_PAYOUT" }; // never create records from a webhook
  }

  // Relationship check: a stored id that disagrees means something is wrong —
  // flag it and change nothing.
  if (payout.stripeTransferId && payout.stripeTransferId !== transfer.id) {
    await alertAdmins(
      tx,
      "payout_transfer_conflict",
      `Payout ${payout.id} is linked to transfer ${payout.stripeTransferId} but received ${transfer.id}. Not settled — manual review required.`,
    );
    return { ok: false, reason: "TRANSFER_MISMATCH" };
  }

  // Defensive amount/currency check against the ledger.
  if (typeof transfer.amount === "number" && transfer.amount !== payout.amountCents) {
    await alertAdmins(
      tx,
      "payout_amount_mismatch",
      `Transfer ${transfer.id} is ${transfer.amount} but payout ${payout.id} is ${payout.amountCents}. NOT marked paid.`,
    );
    return { ok: false, reason: "AMOUNT_MISMATCH" };
  }

  // Backfill the id when the action crashed before storing it (§20).
  if (!payout.stripeTransferId) {
    await tx.payout.updateMany({ where: { id: payout.id, stripeTransferId: null }, data: { stripeTransferId: transfer.id } });
  }

  // Settlement, guarded: only a PROCESSING payout can become PAID.
  const { count } = await tx.payout.updateMany({
    where: { id: payout.id, status: "PROCESSING" },
    data: { status: "PAID", paidAt: new Date(), failureReason: null },
  });
  if (count === 0) return { ok: true, reason: "ALREADY_SETTLED_OR_NOT_PROCESSING" }; // duplicate replay — no-op

  await tx.earning.updateMany({ where: { payoutId: payout.id, status: "ELIGIBLE" }, data: { status: "PAID" } });

  const creator = await tx.creator.findUnique({ where: { id: payout.creatorId }, select: { userId: true } });
  if (creator?.userId) {
    await tx.notification.create({
      data: {
        userId: creator.userId,
        type: "payout_sent",
        // §22 — "sent to your Stripe account", never "in your bank".
        body: `Your payout of ${(payout.amountCents / 100).toFixed(2)} ${payout.currency.toUpperCase()} was sent to your Stripe payout account.`,
      },
    });
  }
  return { ok: true };
}

/**
 * §23 transfer.reversed ⇒ Payout FAILED and earnings released back to ELIGIBLE.
 * Earnings are never marked PAID and never duplicated.
 */
export async function handleTransferReversed(tx: Tx, transfer: TransferShape): Promise<{ ok: boolean; reason?: string }> {
  const metaPayoutId = transfer.metadata?.payoutId ?? null;
  const payout =
    (await tx.payout.findFirst({ where: { stripeTransferId: transfer.id } })) ??
    (metaPayoutId ? await tx.payout.findUnique({ where: { id: metaPayoutId } }) : null);

  if (!payout) {
    console.warn(`[connect:transfer.reversed] no payout for transfer ${transfer.id}`);
    return { ok: false, reason: "NO_PAYOUT" };
  }

  const { count } = await tx.payout.updateMany({
    where: { id: payout.id, status: { in: ["PROCESSING", "PAID"] } },
    data: { status: "FAILED", failureReason: `Stripe reversed transfer ${transfer.id}.`, paidAt: null },
  });
  if (count === 0) return { ok: true, reason: "ALREADY_TERMINAL" }; // duplicate replay — no-op

  // Release: PAID or ELIGIBLE rows go back to the eligible pool, detached.
  await tx.earning.updateMany({
    where: { payoutId: payout.id, status: { in: ["ELIGIBLE", "PAID"] } },
    data: { status: "ELIGIBLE", payoutId: null },
  });

  await alertAdmins(
    tx,
    "payout_reversed",
    `Transfer ${transfer.id} for payout ${payout.id} was reversed. Payout FAILED; ${payout.amountCents} cents returned to the eligible pool.`,
  );
  return { ok: true };
}

/** In-app admin alert, mirroring lib/payments.ts. */
async function alertAdmins(tx: Tx, type: string, body: string): Promise<void> {
  const admins = await tx.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  for (const a of admins) await tx.notification.create({ data: { userId: a.id, type, body } });
  if (admins.length === 0) console.warn(`[connect:${type}] ${body}`);
}
