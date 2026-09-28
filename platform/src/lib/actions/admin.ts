"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";

/** Every admin mutation re-verifies ADMIN from the signed session. */
async function assertAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") throw new Error("FORBIDDEN");
  return user;
}

export async function adminDeleteUser(formData: FormData) {
  const admin = await assertAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id || id === admin.id) throw new Error("Cannot delete this account");
  await prisma.user.delete({ where: { id } }); // cascades to profile/creator/brand/etc.
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

export async function adminSetRole(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["ADMIN", "BRAND", "CREATOR", "CUSTOMER"].includes(role)) throw new Error("Invalid role");
  await prisma.user.update({ where: { id }, data: { role: role as "ADMIN" | "BRAND" | "CREATOR" | "CUSTOMER" } });
  revalidatePath("/admin/users");
}
