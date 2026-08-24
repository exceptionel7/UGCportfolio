"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { notify } from "@/lib/notify";

/**
 * Messaging (Phase 9) — persisted in PostgreSQL, scoped to a campaign between
 * the owning brand and the selected creator. Only those two participants can
 * post; everyone else is rejected server-side.
 */
export async function sendMessage(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");
  const campaignId = String(formData.get("campaignId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 4000);
  if (!body) return;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { brand: { select: { userId: true } }, selectedCreator: { select: { userId: true } } },
  });
  if (!campaign) throw new Error("Campaign not found");

  const brandUid = campaign.brand.userId;
  const creatorUid = campaign.selectedCreator?.userId ?? null;

  let toId: string | null = null;
  if (user.id === brandUid) toId = creatorUid;
  else if (user.id === creatorUid) toId = brandUid;
  else throw new Error("FORBIDDEN: not a participant");
  if (!toId) throw new Error("No counterpart selected for this campaign yet");

  await prisma.message.create({ data: { campaignId, fromId: user.id, toId, body } });
  await notify(toId, "message", `New message on "${campaign.title}".`);
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  revalidatePath("/dashboard/messages");
}

/** Mark the messages in a campaign thread as read for the current user. */
export async function markThreadRead(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return;
  const campaignId = String(formData.get("campaignId") ?? "");
  await prisma.message.updateMany({ where: { campaignId, toId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
}
