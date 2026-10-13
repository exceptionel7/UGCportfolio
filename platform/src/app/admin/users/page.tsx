import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { fmtDate } from "@/lib/format";
import { adminDeleteUser, adminSetRole } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: { role?: string } }) {
  const role = searchParams.role;
  const where = role && ["ADMIN", "BRAND", "CREATOR", "CUSTOMER"].includes(role) ? { role: role as "ADMIN" | "BRAND" | "CREATOR" | "CUSTOMER" } : {};
  const users = await prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, take: 200, select: { id: true, name: true, email: true, role: true, createdAt: true } });

  return (
    <div className="container-x py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display font-bold text-2xl">Users ({users.length})</h1>
        <Link href="/admin" className="btn btn-ghost btn-sm">← Admin</Link>
      </div>
      <div className="flex gap-2 mb-5">
        {["", "ADMIN", "BRAND", "CREATOR", "CUSTOMER"].map((r) => (
          <Link key={r || "all"} href={`/admin/users${r ? `?role=${r}` : ""}`} className={`pill text-[11px] ${role === r || (!role && !r) ? "!text-white" : ""}`}>{r || "All"}</Link>
        ))}
      </div>
      <div className="grid gap-2">
        {users.map((u) => (
          <div key={u.id} className="card p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">{u.name || "—"} <span className="pill text-[10px] ml-1">{u.role}</span></p>
              <p className="text-xs text-zinc-500">{u.email} · joined {fmtDate(u.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <form action={adminSetRole} className="flex items-center gap-1">
                <input type="hidden" name="id" value={u.id} />
                <select name="role" defaultValue={u.role} className="field !py-1 !text-xs !w-32">
                  {["ADMIN", "BRAND", "CREATOR", "CUSTOMER"].map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm">Set role</button>
              </form>
              <form action={adminDeleteUser}><input type="hidden" name="id" value={u.id} /><button className="btn btn-ghost btn-sm !text-rose-400">Delete</button></form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
