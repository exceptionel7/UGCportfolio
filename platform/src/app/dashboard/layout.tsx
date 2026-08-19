import { requireUser } from "@/lib/rbac";

// Server-side guard (defense in depth alongside middleware).
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireUser("/dashboard");
  return <div className="min-h-screen">{children}</div>;
}
