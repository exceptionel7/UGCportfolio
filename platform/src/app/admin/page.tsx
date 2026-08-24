import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/SignOutButton";

export default async function AdminPage() {
  // Reached only by ADMIN (middleware + layout guard). Reads live from the DB.
  const [users, brands, creators, customers, campaigns, orders, reviews] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "BRAND" } }),
    prisma.user.count({ where: { role: "CREATOR" } }),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.campaign.count(),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.review.count(),
  ]);
  const recent = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });

  const box = (label: string, value: number) => (
    <div key={label} className="card p-5">
      <div className="font-display font-bold text-3xl">{value}</div>
      <p className="text-sm text-zinc-400">{label}</p>
    </div>
  );

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="pill mb-2">Admin</span>
          <h1 className="font-display font-bold text-3xl">Platform overview</h1>
        </div>
        <SignOutButton />
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <a href="/admin/users" className="btn btn-ghost btn-sm">Users</a>
        <a href="/admin/campaigns" className="btn btn-ghost btn-sm">Campaigns</a>
        <a href="/dashboard" className="btn btn-ghost btn-sm">My dashboard</a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {box("Accounts", users)}
        {box("Brands", brands)}
        {box("Creators", creators)}
        {box("Customers", customers)}
        {box("Campaigns", campaigns)}
        {box("Paid orders", orders)}
        {box("Reviews", reviews)}
      </div>

      <div className="card p-6 mt-6">
        <h2 className="font-semibold text-lg mb-4">Recent accounts</h2>
        {recent.length ? (
          <div className="grid gap-2">
            {recent.map((u) => (
              <div key={u.id} className="flex items-center justify-between text-sm border-b border-white/5 pb-2">
                <span>{u.name || "—"} <span className="pill ml-2 text-[10px]">{u.role}</span></span>
                <span className="text-zinc-500">{u.email}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No accounts yet.</p>
        )}
      </div>

      <p className="text-xs text-zinc-500 mt-6">
        Full management modules (users, campaigns, products, orders, payments, courses, coupons, content) are added in
        Phase 17 — each write operation authorized server-side. Payments, email, storage and TikTok Shop remain
        <b> NOT CONNECTED</b> until their keys are provided.
      </p>
    </main>
  );
}
