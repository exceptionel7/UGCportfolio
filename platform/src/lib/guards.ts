import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";

/**
 * Ownership + role guards (Phase 12). All identity comes from the signed
 * session — never the client. Every mutation that touches a Creator, Brand,
 * or Campaign resolves ownership through these helpers before acting.
 */

export async function requireCreator() {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/dashboard");
  if (user.role !== "CREATOR") redirect("/dashboard?forbidden=1");
  let creator = await prisma.creator.findUnique({ where: { userId: user.id } });
  if (!creator) creator = await prisma.creator.create({ data: { userId: user.id } });
  return { user, creator };
}

export async function requireBrand() {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/dashboard");
  if (user.role !== "BRAND") redirect("/dashboard?forbidden=1");
  let brand = await prisma.brand.findUnique({ where: { userId: user.id } });
  if (!brand) brand = await prisma.brand.create({ data: { userId: user.id, companyName: user.name ?? "" } });
  return { user, brand };
}

export async function requireCustomer() {
  const user = await getSessionUser();
  if (!user) redirect("/login?callbackUrl=/dashboard");
  if (user.role !== "CUSTOMER") redirect("/dashboard?forbidden=1");
  return { user };
}

/** Loads a campaign only if the current BRAND owns it. Throws otherwise. */
export async function ownedCampaignOrThrow(campaignId: string) {
  const { brand } = await requireBrand();
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.brandId !== brand.id) throw new Error("FORBIDDEN: not your campaign");
  return { brand, campaign };
}

/** Loads a campaign only if the current CREATOR is the selected creator. */
export async function assignedCampaignOrThrow(campaignId: string) {
  const { creator } = await requireCreator();
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.selectedCreatorId !== creator.id) throw new Error("FORBIDDEN: not your assignment");
  return { creator, campaign };
}
