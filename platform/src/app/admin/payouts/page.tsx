import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { usd, fmtDate, PAYOUT_STATUS_LABEL } from "@/lib/format";
import { sumNetCents } from "@/lib/payments";
import { createPayoutForCreator, markPayoutPaid, markPayoutFailed } from "@/lib/actions/payouts";

export const dynamic = "force-dynamic";

/**
 * ADMIN payouts — ledger only. Stripe Connect is NOT CONNECTED, so "Mark paid"
 * records a settlement made out-of-band; it never moves money by itself.
 * Route access is enforced by app/admin/layout.tsx; each action re-checks ADMIN.
 */
export default async function AdminPayoutsPage() {
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
        Ledger only — Stripe Connect is <b>NOT CONNECTED</b>. Settle out-of-band, then record it here.
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
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-display font-bold">{usd(sumNetCents(rows))}</span>
                <form action={createPayoutForCreator}>
                  <input type="hidden" name="creatorId" value={creatorId} />
                  <button type="submit" className="btn btn-sm">Create payout</button>
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
            const open = p.status === "PENDING" || p.status === "PROCESSING";
            return (
              <div key={p.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{who(p.creator)}</p>
                    <p className="text-xs text-zinc-500">
                      {usd(p.amountCents)} {p.currency.toUpperCase()} · {p._count.earnings} earning(s) · created {fmtDate(p.createdAt)}
                      {p.paidAt ? ` · paid ${fmtDate(p.paidAt)}` : ""}
                    </p>
                    {p.failureReason && <p className="text-xs text-rose-400 mt-1">{p.failureReason}</p>}
                  </div>
                  <span className="pill text-[11px] shrink-0">{PAYOUT_STATUS_LABEL[p.status] ?? p.status}</span>
                </div>
                {open && (
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <form action={markPayoutPaid}>
                      <input type="hidden" name="payoutId" value={p.id} />
                      <button type="submit" className="btn btn-sm">Mark paid</button>
                    </form>
                    <form action={markPayoutFailed} className="flex items-center gap-2">
                      <input type="hidden" name="payoutId" value={p.id} />
                      <input
                        name="reason"
                        placeholder="Failure reason (optional)"
                        className="field text-xs"
                        maxLength={500}
                      />
                      <button type="submit" className="btn btn-ghost btn-sm">Mark failed</button>
                    </form>
                    <span className="text-[11px] text-zinc-500">Marking failed returns these earnings to the eligible pool.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
