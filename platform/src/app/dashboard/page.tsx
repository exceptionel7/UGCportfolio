import Link from "next/link";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { usd } from "@/lib/format";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <div className="font-display font-bold text-3xl">{value}</div>
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );
}

export default async function DashboardOverview({ searchParams }: { searchParams: { forbidden?: string } }) {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div>
      {searchParams?.forbidden && (
        <div className="card p-4 mb-5 border !border-amber-500/40 text-amber-300 text-sm">
          You don&apos;t have access to that area with your current role ({user.role}).
        </div>
      )}
      <h1 className="font-display font-bold text-2xl sm:text-3xl mb-6">Welcome{user.name ? `, ${user.name}` : ""}</h1>

      {user.role === "BRAND" && (await (async () => {
        const brand = await prisma.brand.findUnique({ where: { userId: user.id } });
        const [total, open] = brand
          ? await Promise.all([
              prisma.campaign.count({ where: { brandId: brand.id } }),
              prisma.campaign.count({ where: { brandId: brand.id, status: { in: ["OPEN", "APPLICATIONS"] } } }),
            ])
          : [0, 0];
        return (
          <>
            <div className="grid sm:grid-cols-3 gap-4">
              <Stat label="Campaigns" value={total} />
              <Stat label="Open for creators" value={open} />
              <Stat label="Payments (paid)" value={usd(0)} />
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link href="/dashboard/campaigns/new" className="btn btn-primary">Create a campaign</Link>
              <Link href="/marketplace" className="btn btn-ghost">Find creators</Link>
            </div>
          </>
        );
      })())}

      {user.role === "CREATOR" && (await (async () => {
        const creator = await prisma.creator.findUnique({ where: { userId: user.id } });
        const [apps, assigned, portfolio] = creator
          ? await Promise.all([
              prisma.application.count({ where: { creatorId: creator.id } }),
              prisma.campaign.count({ where: { selectedCreatorId: creator.id } }),
              prisma.portfolioItem.count({ where: { creatorId: creator.id } }),
            ])
          : [0, 0, 0];
        return (
          <>
            <div className="grid sm:grid-cols-3 gap-4">
              <Stat label="Applications" value={apps} />
              <Stat label="Assigned campaigns" value={assigned} />
              <Stat label="Portfolio items" value={portfolio} />
            </div>
            <div className="flex flex-wrap gap-3 mt-6">
              <Link href="/dashboard/browse" className="btn btn-primary">Browse campaigns</Link>
              <Link href="/dashboard/profile" className="btn btn-ghost">Complete profile</Link>
            </div>
          </>
        );
      })())}

      {user.role === "CUSTOMER" && (
        <div className="card p-6">
          <p className="text-zinc-300">Your account is active.</p>
          <p className="text-sm text-zinc-500 mt-2">Shopping, digital products and courses run on the prototype today and are being ported to this production app in later phases.</p>
          <Link href="/dashboard/profile" className="btn btn-ghost mt-4">Edit profile</Link>
        </div>
      )}

      {user.role === "ADMIN" && (
        <div className="card p-6">
          <p className="text-zinc-300">You are an administrator.</p>
          <Link href="/admin" className="btn btn-primary mt-4">Open Admin Panel</Link>
        </div>
      )}
    </div>
  );
}
