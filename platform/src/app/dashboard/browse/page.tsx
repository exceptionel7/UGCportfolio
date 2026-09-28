import { requireCreator } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { usd, fmtDate } from "@/lib/format";
import { applyToCampaign } from "@/lib/actions/campaigns";

export default async function BrowsePage() {
  const { creator } = await requireCreator();
  const [open, myApps] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: { in: ["OPEN", "APPLICATIONS"] } },
      orderBy: { createdAt: "desc" },
      include: { brand: { select: { companyName: true } } },
    }),
    prisma.application.findMany({ where: { creatorId: creator.id }, select: { campaignId: true } }),
  ]);
  const applied = new Set(myApps.map((a) => a.campaignId));

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Available campaigns</h1>
      <p className="text-sm text-zinc-400 mb-6">Live from PostgreSQL. Apply with a short note.</p>

      {open.length === 0 ? (
        <div className="card p-10 text-center text-zinc-400">No open campaigns right now. Check back soon.</div>
      ) : (
        <div className="grid gap-4">
          {open.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-xs text-zinc-500">{c.brand.companyName || "Brand"} · {c.numVideos} video(s) · budget {usd(c.budgetCents)} · due {fmtDate(c.deadline)}</p>
                </div>
                <span className="pill text-[11px]">{c.status}</span>
              </div>
              {c.brief && <p className="text-sm text-zinc-400 mt-2">{c.brief}</p>}
              {applied.has(c.id) ? (
                <p className="text-sm text-emerald-400 mt-3">Applied ✓</p>
              ) : (
                <form action={applyToCampaign} className="mt-3 flex flex-col sm:flex-row gap-2">
                  <input type="hidden" name="campaignId" value={c.id} />
                  <input className="field flex-1" name="message" placeholder="Why you're a great fit (optional)" />
                  <button className="btn btn-primary btn-sm shrink-0">Apply</button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
