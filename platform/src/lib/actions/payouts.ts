"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guards";
import { notify } from "@/lib/notify";
import { getPlatformSetting, sumNetCents } from "@/lib/payments";
import { transferPayout } from "@/lib/connect-payouts";

/**
 * ADMIN payout actions.
 *
 * A Payout batches a creator's ELIGIBLE earnings. Real settlement happens via a
 * Stripe Connect transfer (lib/connect-payouts.ts) and is confirmed ONLY by the
 * verified transfer.created webhook.
 *
 * INVARIANTS
 *  - Only ELIGIBLE, unbatched earnings can enter a payout (never PENDING).
 *  - An earning belongs to at most one payout — claimed via a guarded
 *    updateMany, so two concurrent admins cannot double-pay the same earning.
 *  - Payout amount is the sum of creator-NET cents; the platform fee is never
 *    paid out and never recomputed.
 *  - createPayoutForCreator RESERVES ONLY — it never moves money.
 *  - markPayoutPaid is an out-of-band ledger fallback and REFUSES any payout
 *    that is PROCESSING or already has a stripeTransferId: once Stripe owns the
 *    transfer, only the webhook may settle it. No browser action can ever
 *    perform PROCESSING → PAID.
 *  - Every transition is idempotent: re-running is a no-op, never a double.
 *  - Nothing here touches Stripe Checkout, payment settlement, or Payment rows.
 */

function requiredId(formData: FormData, field: string): string {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) throw new Error(`Missing ${field}.`);
  return value;
}

function revalidatePayoutViews() {
  revalidatePath("/admin/payouts");
  revalidatePath("/dashboard/earnings");
}

async function creatorUserId(creatorId: string) {
  const creator = await prisma.creator.findUnique({ where: { id: creatorId }, select: { userId: true } });
  return creator?.userId ?? null;
}

/**
 * Batch every ELIGIBLE, unbatched earning for one creator into a new PENDING
 * payout. Amount = sum of netCents.
 */
export async function createPayoutForCreator(formData: FormData) {
  await requireAdmin();
  const creatorId = requiredId(formData, "creatorId");
  const setting = await getPlatformSetting();

  const created = await prisma.$transaction(async (tx) => {
    const earnings = await tx.earning.findMany({
      where: { creatorId, status: "ELIGIBLE", payoutId: null },
      select: { id: true, netCents: true },
    });
    if (earnings.length === 0) throw new Error("No eligible earnings for this creator.");

    const amountCents = sumNetCents(earnings);
    const payout = await tx.payout.create({
      data: { creatorId, amountCents, currency: setting.currency, status: "PENDING" },
    });

    // Claim the rows under the SAME predicate they were selected with. If a
    // concurrent payout grabbed any of them, the count differs and we throw —
    // rolling back this payout entirely rather than paying an earning twice.
    const { count } = await tx.earning.updateMany({
      where: { id: { in: earnings.map((e) => e.id) }, status: "ELIGIBLE", payoutId: null },
      data: { payoutId: payout.id },
    });
    if (count !== earnings.length) {
      throw new Error("Eligible earnings changed while building this payout. Nothing was created — please retry.");
    }

    return { payoutId: payout.id, amountCents, count };
  });

  await notify(
    await creatorUserId(creatorId),
    "payout_pending",
    `A payout of ${(created.amountCents / 100).toFixed(2)} ${setting.currency.toUpperCase()} covering ${created.count} campaign(s) is being prepared.`,
  );
  revalidatePayoutViews();
}

/**
 * OUT-OF-BAND ledger settlement (used when Stripe Connect is not the payout rail).
 *
 * HARD LIMIT: refuses any payout that is PROCESSING or already carries a
 * stripeTransferId. A Stripe transfer in flight may only be settled by the
 * verified transfer.created webhook — never by a browser action.
 */
export async function markPayoutPaid(formData: FormData) {
  await requireAdmin();
  const payoutId = requiredId(formData, "payoutId");

  const existing = await prisma.payout.findUnique({
    where: { id: payoutId },
    select: { status: true, stripeTransferId: true },
  });
  if (!existing) throw new Error("Payout not found.");
  if (existing.stripeTransferId || existing.status === "PROCESSING") {
    throw new Error("This payout is being settled by Stripe. Only a verified Stripe transfer event can mark it paid.");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Guarded in SQL — PENDING only, and only while no Stripe transfer exists.
    const { count } = await tx.payout.updateMany({
      where: { id: payoutId, status: "PENDING", stripeTransferId: null },
      data: { status: "PAID", paidAt: new Date(), failureReason: null },
    });
    if (count === 0) return null; // already settled or now Stripe-owned — nothing to do

    await tx.earning.updateMany({
      where: { payoutId, status: "ELIGIBLE" },
      data: { status: "PAID" },
    });

    return tx.payout.findUnique({ where: { id: payoutId }, select: { creatorId: true, amountCents: true, currency: true } });
  });

  if (result) {
    await notify(
      await creatorUserId(result.creatorId),
      "payout_paid",
      `Your payout of ${(result.amountCents / 100).toFixed(2)} ${result.currency.toUpperCase()} has been sent.`,
    );
  }
  revalidatePayoutViews();
}

/**
 * Mark a payout FAILED and RELEASE its earnings back to the eligible pool
 * (payoutId → null) so they can be batched into a fresh payout. The failed
 * payout row is kept for audit.
 */
export async function markPayoutFailed(formData: FormData) {
  await requireAdmin();
  const payoutId = requiredId(formData, "payoutId");
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500) || "Marked failed by admin.";

  const released = await prisma.$transaction(async (tx) => {
    const { count } = await tx.payout.updateMany({
      where: { id: payoutId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "FAILED", failureReason: reason },
    });
    if (count === 0) return null; // already terminal — never un-pay a PAID payout

    // Only ELIGIBLE rows are released; anything already PAID stays PAID.
    await tx.earning.updateMany({ where: { payoutId, status: "ELIGIBLE" }, data: { payoutId: null } });
    return tx.payout.findUnique({ where: { id: payoutId }, select: { creatorId: true } });
  });

  if (released) {
    await notify(
      await creatorUserId(released.creatorId),
      "payout_failed",
      "A payout attempt did not go through. Your earnings remain eligible and will be re-attempted.",
    );
  }
  revalidatePayoutViews();
}


/**
 * Send a payout as a REAL Stripe Connect transfer.
 *
 * Thin form wrapper around transferPayout(), which owns the authorization,
 * readiness gate, atomic PENDING → PROCESSING reservation, and Stripe call.
 * This action can never mark the payout PAID — that is the webhook's job alone.
 *
 * Returns nothing; the resulting state is read back from the payout row. Any
 * failure is recorded as a safe, pre-formatted failureReason rather than a raw
 * Stripe error string.
 */
export async function sendPayoutTransfer(formData: FormData) {
  const payoutId = requiredId(formData, "payoutId");
  const result = await transferPayout(payoutId);

  // Surface blocked/not-ready outcomes that leave no trace on the row, so the
  // admin gets feedback instead of a silent no-op.
  if (!result.ok && (result.status === "NOT_READY" || result.status === "BLOCKED")) {
    await prisma.payout.updateMany({
      where: { id: payoutId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { failureReason: `${result.code ?? result.status}: ${result.message ?? ""}`.slice(0, 500) },
    });
  }

  revalidatePayoutViews();
}
