import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { usd, fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      brand: { select: { companyName: true } },
      _count: { select: { applications: true, deliverables: true } },
    },
  });

  return (
    <div className="container-x py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-bold text-2xl">Campaigns ({campaigns.length})</h1>
        <Link href="/admin" className="btn btn-ghost btn-sm">← Admin</Link>
      </div>
      {campaigns.length === 0 ? (
        <div className="card p-10 text-center text-zinc-400">No campaigns yet.</div>
      ) : (
        <div className="grid gap-2">
          {campaigns.map((c) => (
            <div key={c.id} className="card p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-sm">{c.title}</p>
                <p className="text-xs text-zinc-500">{c.brand.companyName || "Brand"} · {usd(c.budgetCents)} · {c._count.applications} applicant(s) · {c._count.deliverables} deliverable(s) · {fmtDate(c.createdAt)}</p>
              </div>
              <span className="pill text-[11px]">{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
