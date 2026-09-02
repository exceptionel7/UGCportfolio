import Link from "next/link";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { usd, fmtDate } from "@/lib/format";

export default async function CampaignsPage() {
  const user = await getSessionUser();
  if (!user) return null;

  if (user.role === "BRAND") {
    const brand = await prisma.brand.findUnique({ where: { userId: user.id } });
    const campaigns = brand
      ? await prisma.campaign.findMany({
          where: { brandId: brand.id },
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { applications: true, deliverables: true } } },
        })
      : [];
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display font-bold text-2xl">Campaigns</h1>
          <Link href="/dashboard/campaigns/new" className="btn btn-primary btn-sm">+ New campaign</Link>
        </div>
        {campaigns.length === 0 ? (
          <div className="card p-10 text-center text-zinc-400">No campaigns yet. Create your first brief.</div>
        ) : (
          <div className="grid gap-3">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/dashboard/campaigns/${c.id}`} className="card p-4 flex items-center justify-between hover:border-white/20">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-xs text-zinc-500">{c.numVideos} video(s) · {usd(c.budgetCents)} · {c._count.applications} applicant(s) · due {fmtDate(c.deadline)}</p>
                </div>
                <span className="pill text-[11px]">{c.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (user.role === "CREATOR") {
    const creator = await prisma.creator.findUnique({ where: { userId: user.id } });
    const campaigns = creator
      ? await prisma.campaign.findMany({
          where: { selectedCreatorId: creator.id },
          orderBy: { updatedAt: "desc" },
          include: { brand: { select: { companyName: true } } },
        })
      : [];
    return (
      <div>
        <h1 className="font-display font-bold text-2xl mb-6">My campaigns</h1>
        {campaigns.length === 0 ? (
          <div className="card p-10 text-center text-zinc-400">No assigned campaigns yet. <Link href="/dashboard/browse" className="text-gradient">Browse & apply →</Link></div>
        ) : (
          <div className="grid gap-3">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/dashboard/campaigns/${c.id}`} className="card p-4 flex items-center justify-between hover:border-white/20">
                <div>
                  <p className="font-semibold">{c.title}</p>
                  <p className="text-xs text-zinc-500">{c.brand.companyName || "Brand"}</p>
                </div>
                <span className="pill text-[11px]">{c.status}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <div className="card p-10 text-center text-zinc-400">Campaigns are for brands and creators.</div>;
}
