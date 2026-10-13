import { requireRole } from "@/lib/rbac";

// Admin is protected here on the server AND in middleware. A CUSTOMER/BRAND/
// CREATOR cannot reach any /admin route regardless of client-side tampering.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("ADMIN", "/admin");
  return <div className="min-h-screen">{children}</div>;
}
