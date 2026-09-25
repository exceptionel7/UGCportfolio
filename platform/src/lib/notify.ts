import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * In-app notifications (Phase 10), stored in PostgreSQL.
 *
 * Email delivery is intentionally NOT triggered here — the email provider is
 * NOT CONNECTED. When Resend is configured (Phase 12 of the roadmap), call
 * lib/mail here after creating the DB notification. We never fake a send.
 */
export async function notify(userId: string | null | undefined, type: string, body: string) {
  if (!userId) return;
  await prisma.notification.create({ data: { userId, type, body } });
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
}
