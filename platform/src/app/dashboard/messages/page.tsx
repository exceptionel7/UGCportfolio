import Link from "next/link";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export default async function MessagesPage() {
  const user = await getSessionUser();
  if (!user) return null;

  // Conversations = campaigns where the user is a participant (owning brand or
  // selected creator) and a creator has been selected.
  let campaigns: { id: string; title: string; counterpart: string }[] = [];

  if (user.role === "BRAND") {
    const brand = await prisma.brand.findUnique({ where: { userId: user.id } });
    if (brand) {
      const rows = await prisma.campaign.findMany({
        where: { brandId: brand.id, selectedCreatorId: { not: null } },
        include: { selectedCreator: { include: { user: { select: { name: true, email: true } } } } },
        orderBy: { updatedAt: "desc" },
      });
      campaigns = rows.map((c) => ({ id: c.id, title: c.title, counterpart: c.selectedCreator?.user.name || c.selectedCreator?.user.email || "Creator" }));
    }
  } else if (user.role === "CREATOR") {
    const creator = await prisma.creator.findUnique({ where: { userId: user.id } });
    if (creator) {
      const rows = await prisma.campaign.findMany({
        where: { selectedCreatorId: creator.id },
        include: { brand: { select: { companyName: true } } },
        orderBy: { updatedAt: "desc" },
      });
      campaigns = rows.map((c) => ({ id: c.id, title: c.title, counterpart: c.brand.companyName || "Brand" }));
    }
  }

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Messages</h1>
      <p className="text-sm text-zinc-400 mb-6">Conversations are tied to campaigns and persist in PostgreSQL.</p>
      {campaigns.length === 0 ? (
        <div className="card p-10 text-center text-zinc-400">No conversations yet. A thread opens once a creator is selected for a campaign.</div>
      ) : (
        <div className="grid gap-3">
          {campaigns.map((c) => (
            <Link key={c.id} href={`/dashboard/campaigns/${c.id}`} className="card p-4 flex items-center justify-between hover:border-white/20">
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="text-xs text-zinc-500">with {c.counterpart}</p>
              </div>
              <span className="btn btn-ghost btn-sm">Open thread</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
