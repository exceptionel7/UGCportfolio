import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { storageConnected } from "@/lib/storage";

/**
 * Vercel Blob client-upload token route (Phase 8).
 *
 * Flow: the browser calls `upload()` (from @vercel/blob/client), which POSTs
 * here. We authenticate + authorize BEFORE issuing an upload token, so no one
 * can obtain a token for a resource they don't own. The file uploads directly
 * browser→Blob (bypassing the serverless body limit, so large videos work).
 * On completion, Vercel calls us back and we persist metadata in PostgreSQL.
 *
 * If BLOB_READ_WRITE_TOKEN is not set, we return 501 STORAGE_NOT_CONFIGURED
 * and never issue a token — nothing is faked.
 */
const ALLOWED = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/quicktime", "video/webm",
  "application/pdf",
];

export async function POST(req: Request): Promise<NextResponse> {
  if (!storageConnected()) {
    return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 501 });
  }

  const body = (await req.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        const user = await getSessionUser();
        if (!user) throw new Error("Unauthorized");

        const payload = clientPayload ? (JSON.parse(clientPayload) as { scope?: string; campaignId?: string }) : {};
        const scope = payload.scope;

        // ---- Ownership checks BEFORE a token is granted ----
        if (scope === "portfolio") {
          if (user.role !== "CREATOR") throw new Error("Forbidden");
        } else if (scope === "deliverable") {
          const creator = await prisma.creator.findUnique({ where: { userId: user.id } });
          const campaign = payload.campaignId ? await prisma.campaign.findUnique({ where: { id: payload.campaignId } }) : null;
          if (!creator || !campaign || campaign.selectedCreatorId !== creator.id) throw new Error("Forbidden: not the selected creator for this campaign");
        } else if (scope === "brief") {
          const brand = await prisma.brand.findUnique({ where: { userId: user.id } });
          const campaign = payload.campaignId ? await prisma.campaign.findUnique({ where: { id: payload.campaignId } }) : null;
          if (!brand || !campaign || campaign.brandId !== brand.id) throw new Error("Forbidden: not your campaign");
        } else {
          throw new Error("Invalid upload scope");
        }

        return {
          allowedContentTypes: ALLOWED,
          maximumSizeInBytes: 500 * 1024 * 1024, // 500 MB
          tokenPayload: JSON.stringify({ uploaderId: user.id, scope, campaignId: payload.campaignId ?? null }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Runs server-to-server after the upload completes (on Vercel).
        try {
          const p = tokenPayload ? (JSON.parse(tokenPayload) as { uploaderId: string; scope: string; campaignId: string | null }) : null;
          if (!p) return;
          await prisma.fileAsset.create({
            data: { uploaderId: p.uploaderId, scope: p.scope, url: blob.url, pathname: blob.pathname, contentType: blob.contentType, campaignId: p.campaignId },
          });
        } catch {
          // metadata is best-effort; the domain record still stores the URL
        }
      },
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
