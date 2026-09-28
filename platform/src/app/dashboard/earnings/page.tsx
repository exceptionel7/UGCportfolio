import { requireCreator } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { usd, fmtDate, EARNING_STATUS_LABEL, PAYOUT_STATUS_LABEL } from "@/lib/format";
import { sumNetCents } from "@/lib/payments";

export const dynamic = "force-dynamic";

/**
 * Creator earnings — read from the Earning ledger, which is written ONLY by
 * verified Stripe webhook settlement. Amounts shown are creator NET (gross
 * minus the platform fee snapshot), never gross.
 */
export default async function EarningsPage() {
  const { creator } = await requireCreator();

  const earnings = await prisma.earning.findMany({
    where: { creatorId: creator.id },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, title: true, status: true } },
      payout: { select: { id: true, status: true, paidAt: true } },
    },
  });

  const byStatus = (status: string) => earnings.filter((e) => e.status === status);
  const paid = byStatus("PAID");
  const eligible = byStatus("ELIGIBLE");
  const pending = byStatus("PENDING");
  const lifetime = sumNetCents([...paid, ...eligible, ...pending]);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Earnings</h1>
      <p className="text-xs text-zinc-500">
        Your share after the platform fee. Recorded only from payments confirmed by a verified Stripe webhook.
      </p>

      <div className="card p-6 mt-3">
        <div className="font-display font-bold text-4xl text-gradient">{usd(lifetime)}</div>
        <p className="text-xs text-zinc-500 mt-2">Lifetime net earnings (excludes canceled).</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 mt-3">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Paid out</p>
          <p className="font-display font-bold text-xl text-emerald-400">{usd(sumNetCents(paid))}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Eligible for payout</p>
          <p className="font-display font-bold text-xl">{usd(sumNetCents(eligible))}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Pending completion</p>
          <p className="font-display font-bold text-xl text-zinc-400">{usd(sumNetCents(pending))}</p>
        </div>
      </div>

      {eligible.length > 0 && (
        <p className="text-xs text-zinc-500 mt-3">
          Eligible earnings are released by an admin. Payouts are settled manually — Stripe Connect is{" "}
          <b>NOT CONNECTED</b>, so no automatic transfers occur yet.
        </p>
      )}

      <div className="mt-4">
        {earnings.length === 0 ? (
          <div className="card p-8 text-center text-zinc-400">
            No earnings yet. They appear once a brand funds a campaign you are selected for.
          </div>
        ) : (
          <div className="grid gap-2">
            {earnings.map((e) => (
              <div key={e.id} className="card p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{e.campaign.title}</p>
                  <p className="text-xs text-zinc-500">
                    {fmtDate(e.createdAt)} · gross {usd(e.grossCents)} · fee {usd(e.feeCents)} ({e.feeBps / 100}%)
                    {e.eligibleAt ? ` · eligible ${fmtDate(e.eligibleAt)}` : ""}
                    {e.payout ? ` · payout ${PAYOUT_STATUS_LABEL[e.payout.status] ?? e.payout.status}` : ""}
                  </p>
                  <p className="text-[11px] text-zinc-500 mt-1">{EARNING_STATUS_LABEL[e.status] ?? e.status}</p>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={
                      "font-semibold " +
                      (e.status === "PAID" ? "text-emerald-400" : e.status === "CANCELED" ? "text-zinc-500 line-through" : "")
                    }
                  >
                    {usd(e.netCents)}
                  </span>
                  <p className="text-[11px] text-zinc-500">net</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
