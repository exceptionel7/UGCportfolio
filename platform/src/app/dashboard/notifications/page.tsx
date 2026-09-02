import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { markAllRead } from "@/lib/actions/notifications";

export default async function NotificationsPage() {
  const user = await requireUser("/dashboard/notifications");
  const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-2xl">Notifications</h1>
        {items.some((n) => !n.read) && (
          <form action={markAllRead}><button className="btn btn-ghost btn-sm">Mark all read</button></form>
        )}
      </div>
      <p className="text-sm text-zinc-500 mb-4">In-app notifications persist in PostgreSQL. Email delivery is <b>NOT CONNECTED</b>.</p>
      {items.length === 0 ? (
        <div className="card p-10 text-center text-zinc-400">No notifications yet.</div>
      ) : (
        <div className="grid gap-2">
          {items.map((n) => (
            <div key={n.id} className={`card p-4 ${n.read ? "text-zinc-400" : "text-zinc-100"}`}>
              <div className="flex items-center gap-2">
                {!n.read && <span className="w-2 h-2 rounded-full" style={{ background: "var(--brand-2)" }} />}
                <span className="pill text-[10px]">{n.type}</span>
              </div>
              <p className="mt-2 text-sm">{n.body}</p>
              <p className="text-[11px] text-zinc-600 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
