import { requireCreator } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { usd, fmtDate } from "@/lib/format";

export default async function EarningsPage() {
  const { user } = await requireCreator();
  // Earnings are ONLY ever shown from real PAID payment records. No payment
  // provider is connected yet, so this is $0 — never fabricated.
  const paid = await prisma.payment.findMany({
    where: { userId: user.id, kind: "CAMPAIGN", status: "PAID" },
    orderBy: { createdAt: "desc" },
  });
  const total = paid.reduce((s, p) => s + p.amountCents, 0);

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Earnings</h1>
      <div className="card p-6 mt-3">
        <div className="font-display font-bold text-4xl text-gradient">{usd(total)}</div>
        <p className="text-xs text-zinc-500 mt-2">Total from <b>paid</b> campaign payouts. Payments are <b>NOT CONNECTED</b> (Stripe pending), so no payout records exist yet.</p>
      </div>
      <div className="mt-4">
        {paid.length === 0 ? (
          <div className="card p-8 text-center text-zinc-400">No payout records yet.</div>
        ) : (
          <div className="grid gap-2">
            {paid.map((p) => (
              <div key={p.id} className="card p-4 flex justify-between text-sm">
                <span className="text-zinc-400">{fmtDate(p.createdAt)} · {p.stripeRef ?? p.campaignId ?? ""}</span>
                <span className="font-semibold text-emerald-400">{usd(p.amountCents)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
