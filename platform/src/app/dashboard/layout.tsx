import Link from "next/link";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { DashNav } from "@/components/DashNav";
import { SignOutButton } from "@/components/SignOutButton";

const NAV: Record<string, { href: string; label: string }[]> = {
  CREATOR: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/profile", label: "Profile" },
    { href: "/dashboard/portfolio", label: "Portfolio" },
    { href: "/dashboard/browse", label: "Browse Campaigns" },
    { href: "/dashboard/applications", label: "My Applications" },
    { href: "/dashboard/campaigns", label: "My Campaigns" },
    { href: "/dashboard/messages", label: "Messages" },
    { href: "/dashboard/earnings", label: "Earnings" },
    { href: "/dashboard/notifications", label: "Notifications" },
  ],
  BRAND: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/profile", label: "Company Profile" },
    { href: "/dashboard/campaigns", label: "Campaigns" },
    { href: "/marketplace", label: "Find Creators" },
    { href: "/dashboard/messages", label: "Messages" },
    { href: "/dashboard/notifications", label: "Notifications" },
  ],
  CUSTOMER: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/profile", label: "Profile" },
    { href: "/dashboard/notifications", label: "Notifications" },
  ],
  ADMIN: [
    { href: "/dashboard", label: "Overview" },
    { href: "/admin", label: "Admin Panel" },
    { href: "/dashboard/notifications", label: "Notifications" },
  ],
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/dashboard");
  const unread = await prisma.notification.count({ where: { userId: user.id, read: false } });
  const links = (NAV[user.role] ?? NAV.CUSTOMER).map((l) =>
    l.href === "/dashboard/notifications" && unread > 0 ? { ...l, label: `${l.label} (${unread})` } : l,
  );

  return (
    <div className="container-x py-8">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="font-display font-bold text-lg">
          Exception<span className="text-gradient">el</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="pill text-[11px]">{user.role}</span>
          <span className="text-sm text-zinc-400 hidden sm:inline">{user.name || user.email}</span>
          <SignOutButton className="btn btn-ghost" />
        </div>
      </div>
      <div className="grid lg:grid-cols-[220px_1fr] gap-8 items-start">
        <aside className="card p-3 lg:sticky lg:top-6">
          <DashNav links={links} />
        </aside>
        <main className="min-h-[320px]">{children}</main>
      </div>
    </div>
  );
}
