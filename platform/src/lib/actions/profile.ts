"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCreator, requireBrand, requireCustomer } from "@/lib/guards";
import { getSessionUser } from "@/lib/rbac";

function parseList(v: FormDataEntryValue | null): string[] {
  return String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
function dollarsToCents(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  if (!v || Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

/** CREATOR: update own profile (ownership implicit via session). */
export async function updateCreatorProfile(formData: FormData) {
  const { user, creator } = await requireCreator();
  const name = String(formData.get("name") ?? "").trim();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name: name || user.name } }),
    prisma.creator.update({
      where: { id: creator.id },
      data: {
        bio: String(formData.get("bio") ?? "").slice(0, 2000),
        location: String(formData.get("location") ?? "").slice(0, 120),
        languages: parseList(formData.get("languages")),
        niches: parseList(formData.get("niches")),
        styles: parseList(formData.get("styles")),
        categories: parseList(formData.get("categories")),
        rateFromCents: dollarsToCents(formData.get("rateFrom")),
        socials: { raw: String(formData.get("socials") ?? "").slice(0, 500) },
      },
    }),
  ]);
  revalidatePath("/dashboard/profile");
  revalidatePath("/marketplace");
  revalidatePath(`/creators/${creator.id}`);
}

/** BRAND: update own company profile. */
export async function updateBrandProfile(formData: FormData) {
  const { user, brand } = await requireBrand();
  const name = String(formData.get("name") ?? "").trim();
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name: name || user.name } }),
    prisma.brand.update({
      where: { id: brand.id },
      data: {
        companyName: String(formData.get("companyName") ?? "").slice(0, 160) || name,
        website: String(formData.get("website") ?? "").slice(0, 300),
        about: String(formData.get("about") ?? "").slice(0, 2000),
        logoUrl: String(formData.get("logoUrl") ?? "").slice(0, 500) || null,
      },
    }),
  ]);
  revalidatePath("/dashboard/profile");
}

/** CUSTOMER: update own profile + address. */
export async function updateCustomerProfile(formData: FormData) {
  const { user } = await requireCustomer();
  const name = String(formData.get("name") ?? "").trim();
  const schema = z.object({ address: z.string().max(300).optional(), city: z.string().max(120).optional(), zip: z.string().max(30).optional(), country: z.string().max(120).optional() });
  const p = schema.parse({
    address: String(formData.get("address") ?? ""),
    city: String(formData.get("city") ?? ""),
    zip: String(formData.get("zip") ?? ""),
    country: String(formData.get("country") ?? ""),
  });
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { name: name || user.name } }),
    prisma.profile.upsert({ where: { userId: user.id }, update: p, create: { userId: user.id, ...p } }),
  ]);
  revalidatePath("/dashboard/profile");
}

/** Shared name update used by Settings for any role. */
export async function updateName(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const name = String(formData.get("name") ?? "").trim();
  if (name) await prisma.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/dashboard");
}
