"use server";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/rbac";
import { markAllNotificationsRead } from "@/lib/notify";

export async function markAllRead() {
  const user = await getSessionUser();
  if (!user) return;
  await markAllNotificationsRead(user.id);
  revalidatePath("/dashboard/notifications");
  revalidatePath("/dashboard");
}
