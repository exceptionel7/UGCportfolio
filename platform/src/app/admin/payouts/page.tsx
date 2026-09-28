import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { usd, fmtDate, PAYOUT_STATUS_LABEL } from "@/lib/format";
import { sumNetCents } from "@/lib/payments";
import { isConnectEnabled } from "@/lib/connect";
import {
  createPayoutForCreator,
  markPayoutPaid,
  markPayoutFailed,
  sendPayoutTransfer,
} from "@/lib/actions/payouts";

export const dynamic = "force-dynamic";

/**
 * ADMIN payouts.
 *
 * With Connect enabled, "Send payout" creates a REAL Stripe transfer. The payout
 * then sits at PROCESSING until the verified transfer.created webhook settles it —
 * this page never claims PAID on its own.
 *
 * Copy deliberately says "sent to Stripe account", not "arrived in bank": a
 * transfer.created event does not prove bank settlement.
 *
 * Route access is enforced by app/admin/layout.tsx; every action re-checks ADMIN.
 */
export default async function AdminPayoutsPage() {
  const connectOn = isConnectEnabled();
  const creatorInclude = { creator: { include: { user: { select: { name: true, email: true } } } } };

  const [eligible, payouts] = await Promise.all([
    prisma.earning.findMany({
      where: { status: "ELIGIBLE", payoutId: null },
      orderBy: { eligibleAt: "asc" },
      include: { ...creatorInclude, campaign: { select: { title: true } } },
    }),
    prisma.payout.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { ...creatorInclude, _count: { select: { earnings: true } } },
    }),
  ]);

  type Eligible = (typeof eligible)[number];
  const groups = new Map<string, Eligible[]>();
  for (const e of eligible) {
    const list = groups.get(e.creatorId) ?? [];
    list.push(e);
    groups.set(e.creatorId, list);
  }
  const who = (c: { user: { name: string | null; email: string | null } }) => c.user.name || c.user.email || "Creator";

  return (
    <div className="container-x py-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display font-bold text-2xl">Payouts</h1>
        <Link href="/admin" className="btn btn-ghost btn-sm">← Admin</Link>
      </div>
      <p className="text-xs text-zinc-500 mb-4">
        {connectOn ? (
          <>Payouts are sent as Stripe Connect transfers from the platform balance. A payout is only marked <b>Paid</b> after Stripe confirms the transfer.</>
        ) : (
          <>Stripe is <b>NOT CONNECTED</b> — transfers are unavailable. Payouts can only be recorded as settled out-of-band.</>
        )}
      </p>

      <h2 className="font-semibold text-sm mb-2">Eligible for payout ({groups.size} creator(s))</h2>
      {groups.size === 0 ? (
        <div className="card p-8 text-center text-zinc-400 text-sm">
          Nothing eligible. Earnings become eligible when a funded campaign is completed.
        </div>
      ) : (
        <div className="grid gap-2">
          {[...groups.entries()].map(([creatorId, rows]) => (
            <div key={creatorId} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm">{who(rows[0].creator)}</p>
                <p className="text-xs text-zinc-500 truncate">
                  {rows.length} earning(s): {rows.map((r) => r.campaign.title).join(", ")}
                </p>
                {!rows[0].creator.payoutsEnabled && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    Creator has not completed Stripe payout onboarding — a transfer will be refused until they do.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-display font-bold">{usd(sumNetCents(rows))}</span>
                <form action={createPayoutForCreator}>
                  <input type="hidden" name="creatorId" value={creatorId} />
                  <button type="submit" className="btn btn-sm">Reserve payout</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="font-semibold text-sm mt-6 mb-2">Payouts ({payouts.length})</h2>
      {payouts.length === 0 ? (
        <div className="card p-8 text-center text-zinc-400 text-sm">No payouts yet.</div>
      ) : (
        <div className="grid gap-2">
          {payouts.map((p) => {
            const isPending = p.status === "PENDING";
            const isProcessing = p.status === "PROCESSING";
            const isFailed = p.status === "FAILED";
            const stripeOwned = !!p.stripeTransferId;

            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{who(p.creator)}</p>
                    <p className="text-xs text-zinc-500">
                      {usd(p.amountCents)} {p.currency.toUpperCase()} · {p._count.earnings} earning(s) · created {fmtDate(p.createdAt)}
                      {p.paidAt ? ` · sent ${fmtDate(p.paidAt)}` : ""}
                    </p>
                    {stripeOwned && <p className="text-[11px] text-zinc-500 mt-1">Transfer {p.stripeTransferId}</p>}
                    {p.failureReason && <p className="text-xs text-rose-400 mt-1">{p.failureReason}</p>}
                    {p.status === "PAID" && (
                      <p className="text-[11px] text-emerald-400 mt-1">Paid to Stripe Connect account (not a bank-settlement confirmation).</p>
                    )}
                  </div>
                  <span className="pill text-[11px] shrink-0">{PAYOUT_STATUS_LABEL[p.status] ?? p.status}</span>
                </div>

                {isProcessing && (
                  <p className="text-xs text-zinc-400 mt-3">
                    Stripe transfer pending confirmation… this payout settles automatically when Stripe confirms.
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {isPending && connectOn && (
                    <form action={sendPayoutTransfer}>
                      <input type="hidden" name="payoutId" value={p.id} />
                      <button type="submit" className="btn btn-primary btn-sm">Send payout</button>
                    </form>
                  )}
                  {isPending && !connectOn && !stripeOwned && (
                    <form action={markPayoutPaid}>
                      <input type="hidden" name="payoutId" value={p.id} />
                      <button type="submit" className="btn btn-sm">Mark paid (out-of-band)</button>
                    </form>
                  )}
                  {isProcessing && !stripeOwned && (
                    <form action={sendPayoutTransfer}>
                      <input type="hidden" name="payoutId" value={p.id} />
                      <button type="submit" className="btn btn-ghost btn-sm">Reconcile with Stripe</button>
                    </form>
                  )}
                  {(isPending || isProcessing) && (
                    <form action={markPayoutFailed} className="flex items-center gap-2">
                      <input type="hidden" name="payoutId" value={p.id} />
                      <input name="reason" placeholder="Failure reason (optional)" className="field text-xs" maxLength={500} />
                      <button type="submit" className="btn btn-ghost btn-sm">Mark failed</button>
                    </form>
                  )}
                  {isFailed && (
                    <form action={createPayoutForCreator}>
                      <input type="hidden" name="creatorId" value={p.creatorId} />
                      <button type="submit" className="btn btn-sm">Retry (new payout)</button>
                    </form>
                  )}
                </div>

                {isFailed && (
                  <p className="text-[11px] text-zinc-500 mt-2">
                    Earnings from this payout were returned to the eligible pool; Retry reserves them into a fresh payout.
                  </p>
                )}
                {isProcessing && stripeOwned && (
                  <p className="text-[11px] text-zinc-500 mt-2">
                    A transfer already exists for this payout, so it can never be sent twice.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
