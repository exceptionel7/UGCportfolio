"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireBrand, requireCreator, ownedCampaignOrThrow, assignedCampaignOrThrow } from "@/lib/guards";
import { notify } from "@/lib/notify";

function toCents(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  if (!v || Number.isNaN(n)) return null;
  return Math.round(n * 100);
}

async function brandUserId(brandId: string) {
  const b = await prisma.brand.findUnique({ where: { id: brandId }, select: { userId: true } });
  return b?.userId ?? null;
}
async function creatorUserId(creatorId: string) {
  const c = await prisma.creator.findUnique({ where: { id: creatorId }, select: { userId: true } });
  return c?.userId ?? null;
}

/* ---------------- BRAND: create + publish (Phase 5 / 7) ---------------- */
export async function createCampaign(formData: FormData) {
  const { brand } = await requireBrand();
  const publish = String(formData.get("intent") ?? "draft") === "publish";
  const campaign = await prisma.campaign.create({
    data: {
      brandId: brand.id,
      title: String(formData.get("title") ?? "Untitled campaign").slice(0, 200),
      product: String(formData.get("product") ?? "").slice(0, 200) || null,
      brief: String(formData.get("brief") ?? "").slice(0, 5000) || null,
      objective: String(formData.get("objective") ?? "").slice(0, 200) || null,
      numVideos: Math.max(1, parseInt(String(formData.get("numVideos") ?? "1"), 10) || 1),
      budgetCents: toCents(formData.get("budget")),
      deadline: formData.get("deadline") ? new Date(String(formData.get("deadline"))) : null,
      status: publish ? "OPEN" : "DRAFT",
    },
  });
  revalidatePath("/dashboard/campaigns");
  redirect(`/dashboard/campaigns/${campaign.id}`);
}

export async function publishCampaign(formData: FormData) {
  const { campaign } = await ownedCampaignOrThrow(String(formData.get("id") ?? ""));
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "OPEN" } });
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  revalidatePath("/dashboard/campaigns");
}

/* ---------------- CREATOR: apply (Phase 4) ---------------- */
export async function applyToCampaign(formData: FormData) {
  const { creator } = await requireCreator();
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || !["OPEN", "APPLICATIONS"].includes(campaign.status)) throw new Error("Campaign is not open for applications");

  await prisma.application.create({
    data: { campaignId, creatorId: creator.id, message: String(formData.get("message") ?? "").slice(0, 1000) },
  }).catch(() => { throw new Error("You already applied to this campaign"); });

  if (campaign.status === "OPEN") await prisma.campaign.update({ where: { id: campaignId }, data: { status: "APPLICATIONS" } });
  await notify(await brandUserId(campaign.brandId), "application", `New application for "${campaign.title}".`);
  revalidatePath("/dashboard/browse");
  revalidatePath("/dashboard/applications");
}

/* ---------------- BRAND: review applications (Phase 5 / 7) ---------------- */
export async function selectCreator(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new Error("Application not found");
  const { campaign } = await ownedCampaignOrThrow(app.campaignId); // ownership enforced

  await prisma.$transaction([
    prisma.application.update({ where: { id: applicationId }, data: { status: "APPROVED" } }),
    prisma.application.updateMany({ where: { campaignId: campaign.id, id: { not: applicationId } }, data: { status: "REJECTED" } }),
    prisma.campaign.update({ where: { id: campaign.id }, data: { selectedCreatorId: app.creatorId, status: "CREATOR_SELECTED" } }),
  ]);
  await notify(await creatorUserId(app.creatorId), "selected", `You were selected for "${campaign.title}".`);
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
}

export async function rejectApplication(formData: FormData) {
  const applicationId = String(formData.get("applicationId") ?? "");
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) return;
  const { campaign } = await ownedCampaignOrThrow(app.campaignId);
  await prisma.application.update({ where: { id: applicationId }, data: { status: "REJECTED" } });
  await notify(await creatorUserId(app.creatorId), "rejected", `Your application for "${campaign.title}" was not selected.`);
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
}

/* ---------------- CREATOR: production + deliverables (Phase 4 / 7) ---------------- */
export async function startProduction(formData: FormData) {
  const { campaign } = await assignedCampaignOrThrow(String(formData.get("campaignId") ?? ""));
  if (campaign.status === "CREATOR_SELECTED") {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "IN_PRODUCTION" } });
    revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  }
}

export async function submitDeliverable(formData: FormData) {
  const { creator, campaign } = await assignedCampaignOrThrow(String(formData.get("campaignId") ?? ""));
  const fileUrl = String(formData.get("fileUrl") ?? "").trim();
  await prisma.deliverable.create({
    data: {
      campaignId: campaign.id,
      creatorId: creator.id,
      title: String(formData.get("title") ?? "Deliverable").slice(0, 200),
      note: String(formData.get("note") ?? "").slice(0, 2000) || null,
      fileUrl: fileUrl || null, // real hosted URL, or from /api/upload when storage configured
      status: "SUBMITTED",
    },
  });
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "SUBMITTED" } });
  await notify(await brandUserId(campaign.brandId), "deliverable_submitted", `New deliverable submitted for "${campaign.title}".`);
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
}

/* ---------------- BRAND: revision / approval / complete (Phase 5 / 7) ---------------- */
async function ownedDeliverable(deliverableId: string) {
  const { brand } = await requireBrand();
  const d = await prisma.deliverable.findUnique({ where: { id: deliverableId }, include: { campaign: true } });
  if (!d || d.campaign.brandId !== brand.id) throw new Error("FORBIDDEN");
  return { brand, deliverable: d, campaign: d.campaign };
}

export async function requestRevision(formData: FormData) {
  const { deliverable, campaign } = await ownedDeliverable(String(formData.get("deliverableId") ?? ""));
  await prisma.$transaction([
    prisma.deliverable.update({ where: { id: deliverable.id }, data: { status: "REVISION_REQUESTED", revisionNote: String(formData.get("note") ?? "").slice(0, 2000) } }),
    prisma.campaign.update({ where: { id: campaign.id }, data: { status: "REVISION_REQUESTED" } }),
  ]);
  await notify(await creatorUserId(deliverable.creatorId), "revision_requested", `Revision requested for "${campaign.title}".`);
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
}

export async function approveDeliverable(formData: FormData) {
  const { deliverable, campaign } = await ownedDeliverable(String(formData.get("deliverableId") ?? ""));
  await prisma.$transaction([
    prisma.deliverable.update({ where: { id: deliverable.id }, data: { status: "APPROVED" } }),
    prisma.campaign.update({ where: { id: campaign.id }, data: { status: "APPROVED" } }),
  ]);
  await notify(await creatorUserId(deliverable.creatorId), "deliverable_approved", `Your deliverable for "${campaign.title}" was approved.`);
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
}

export async function completeCampaign(formData: FormData) {
  const { campaign } = await ownedCampaignOrThrow(String(formData.get("id") ?? ""));
  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "COMPLETED" } });
  // NOTE: no payment/earnings are recorded here. Real payouts require Stripe
  // (NOT CONNECTED). Earnings are only ever shown from PAID Payment records.
  if (campaign.selectedCreatorId) {
    await notify(await creatorUserId(campaign.selectedCreatorId), "campaign_completed", `"${campaign.title}" is complete. Payout occurs once payments are connected.`);
  }
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
}

/* ---------------- BRAND: attach a brief file (Phase 8) ---------------- */
export async function attachBrief(formData: FormData) {
  const { campaign } = await ownedCampaignOrThrow(String(formData.get("campaignId") ?? ""));
  const url = String(formData.get("briefUrl") ?? "").trim();
  if (!url) return;
  await prisma.campaign.update({ where: { id: campaign.id }, data: { briefFileUrl: url } });
  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
}

/* ---------------- BRAND: invite from marketplace (Phase 6) ---------------- */
export async function inviteCreator(formData: FormData) {
  const { brand } = await requireBrand();
  const creatorId = String(formData.get("creatorId") ?? "");
  const campaignId = String(formData.get("campaignId") ?? "");
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, brandId: brand.id } });
  if (!campaign) throw new Error("Select one of your campaigns to invite to");
  await notify(await creatorUserId(creatorId), "invite", `${campaign.title ? `You're invited to apply to "${campaign.title}"` : "A brand invited you to apply"}.`);
  revalidatePath(`/creators/${creatorId}`);
}
