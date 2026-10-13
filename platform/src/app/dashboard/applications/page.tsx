import Link from "next/link";
import { requireCreator } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";

export default async function ApplicationsPage() {
  const { creator } = await requireCreator();
  const apps = await prisma.application.findMany({
    where: { creatorId: creator.id },
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { id: true, title: true, status: true, selectedCreatorId: true } } },
  });

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">My applications</h1>
      <p className="text-sm text-zinc-400 mb-6">Live from PostgreSQL.</p>
      {apps.length === 0 ? (
        <div className="card p-10 text-center text-zinc-400">No applications yet. <Link href="/dashboard/browse" className="text-gradient">Browse campaigns →</Link></div>
      ) : (
        <div className="grid gap-3">
          {apps.map((a) => {
            const selectedMe = a.campaign.selectedCreatorId === creator.id;
            return (
              <div key={a.id} className="card p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{a.campaign.title}</p>
                  <p className="text-xs text-zinc-500">Applied {fmtDate(a.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="pill text-[11px]">{a.status}</span>
                  {selectedMe && <Link href={`/dashboard/campaigns/${a.campaign.id}`} className="btn btn-ghost btn-sm">Open</Link>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
