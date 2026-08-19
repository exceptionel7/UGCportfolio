import Link from "next/link";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { SignOutButton } from "@/components/SignOutButton";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin", BRAND: "Brand dashboard", CREATOR: "Creator dashboard", CUSTOMER: "Your account",
};

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return null; // layout guard already redirects

  // Real, DB-backed counts appropriate to the role (empty until data exists — no fakes).
  let stats: { label: string; value: number }[] = [];
  if (user.role === "BRAND") {
    const brand = await prisma.brand.findUnique({ where: { userId: user.id } });
    const campaigns = brand ? await prisma.campaign.count({ where: { brandId: brand.id } }) : 0;
    stats = [{ label: "Campaigns", value: campaigns }];
  } else if (user.role === "CREATOR") {
    const creator = await prisma.creator.findUnique({ where: { userId: user.id } });
    const applications = creator ? await prisma.application.count({ where: { creatorId: creator.id } }) : 0;
    stats = [{ label: "Applications", value: applications }];
  } else if (user.role === "CUSTOMER") {
    const orders = await prisma.order.count({ where: { userId: user.id, status: "PAID" } });
    const enrollments = await prisma.enrollment.count({ where: { userId: user.id } });
    stats = [{ label: "Paid orders", value: orders }, { label: "Courses", value: enrollments }];
  }

  return (
    <main className="container-x py-12">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <span className="w-14 h-14 rounded-2xl grid place-items-center font-bold text-white text-xl" style={{ background: "var(--grad)" }}>
            {(user.name || user.email || "?")[0]?.toUpperCase()}
          </span>
          <div>
            <p className="text-sm text-zinc-500">{ROLE_LABEL[user.role] ?? "Account"}</p>
            <h1 className="font-display font-bold text-2xl sm:text-3xl">{user.name || user.email}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {user.role === "ADMIN" && <Link href="/admin" className="btn btn-ghost">Admin panel</Link>}
          <SignOutButton />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mt-8">
        {stats.map((s) => (
          <div key={s.label} className="card p-6">
            <div className="font-display font-bold text-3xl">{s.value}</div>
            <p className="text-sm text-zinc-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-6 mt-6">
        <h2 className="font-semibold text-lg mb-2">Signed in securely ✓</h2>
        <p className="text-sm text-zinc-400">
          Your session is a server-verified Auth.js JWT and your role (<b>{user.role}</b>) is enforced server-side.
          Role-specific dashboard modules (campaigns, portfolio, orders, courses) are being wired to this real database in
          the next phases. Nothing here is fabricated — counts read live from PostgreSQL.
        </p>
      </div>
    </main>
  );
}
