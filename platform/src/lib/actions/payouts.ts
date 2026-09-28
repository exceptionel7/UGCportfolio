"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/guards";
import { notify } from "@/lib/notify";
import { getPlatformSetting, sumNetCents } from "@/lib/payments";

/**
 * ADMIN payout actions — LEDGER ONLY (no Stripe money movement).
 *
 * A Payout is an internal record that batches a creator's ELIGIBLE earnings.
 * An admin settles it out-of-band (bank transfer, etc.) and then marks it PAID,
 * which flips the batched earnings ELIGIBLE → PAID.
 *
 * INVARIANTS
 *  - Only ELIGIBLE, unbatched earnings can enter a payout (never PENDING).
 *  - An earning belongs to at most one payout — claimed via a guarded
 *    updateMany, so two concurrent admins cannot double-pay the same earning.
 *  - Payout amount is the sum of creator-NET cents; the platform fee is never
 *    paid out.
 *  - Every transition is idempotent: re-running is a no-op, never a double.
 *  - Nothing here touches Stripe Checkout, the webhook, or Payment rows.
 *  - stripeTransferId / stripePayoutId stay NULL — they are reserved for real
 *    Stripe Connect transfers and are never filled with non-Stripe references.
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
 * Mark a payout PAID after settling it out-of-band, flipping its earnings
 * ELIGIBLE → PAID. Idempotent: a payout already PAID/FAILED/CANCELED is a no-op.
 */
export async function markPayoutPaid(formData: FormData) {
  await requireAdmin();
  const payoutId = requiredId(formData, "payoutId");

  const result = await prisma.$transaction(async (tx) => {
    // Guarded in SQL — only an open payout can be settled, so a double submit
    // cannot pay twice or resurrect a failed payout.
    const { count } = await tx.payout.updateMany({
      where: { id: payoutId, status: { in: ["PENDING", "PROCESSING"] } },
      data: { status: "PAID", paidAt: new Date(), failureReason: null },
    });
    if (count === 0) return null; // already settled — nothing to do

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
