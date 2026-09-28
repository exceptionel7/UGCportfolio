"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCreator } from "@/lib/guards";

/**
 * Portfolio items persist in PostgreSQL (Phase 4).
 * A real hosted URL is required (no fake/placeholder media). Direct file
 * uploads use /api/upload once Vercel Blob is configured (Phase 8); until then
 * creators paste a real URL to media they host.
 */
const schema = z.object({
  title: z.string().trim().max(160).optional(),
  url: z.string().url({ message: "Enter a valid URL" }),
  kind: z.enum(["VIDEO", "IMAGE"]).default("VIDEO"),
  posterUrl: z.string().url().optional().or(z.literal("")),
  category: z.string().trim().max(80).optional(),
});

export async function addPortfolioItem(formData: FormData) {
  const { creator } = await requireCreator();
  const parsed = schema.safeParse({
    title: String(formData.get("title") ?? ""),
    url: String(formData.get("url") ?? ""),
    kind: String(formData.get("kind") ?? "VIDEO"),
    posterUrl: String(formData.get("posterUrl") ?? ""),
    category: String(formData.get("category") ?? ""),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid portfolio item");

  await prisma.portfolioItem.create({
    data: {
      creatorId: creator.id,
      title: parsed.data.title || null,
      url: parsed.data.url,
      kind: parsed.data.kind,
      posterUrl: parsed.data.posterUrl || null,
      category: parsed.data.category || null,
    },
  });
  revalidatePath("/dashboard/portfolio");
  revalidatePath(`/creators/${creator.id}`);
}

export async function deletePortfolioItem(formData: FormData) {
  const { creator } = await requireCreator();
  const id = String(formData.get("id") ?? "");
  // Ownership check: only delete items belonging to this creator.
  const item = await prisma.portfolioItem.findUnique({ where: { id } });
  if (!item || item.creatorId !== creator.id) throw new Error("FORBIDDEN");
  await prisma.portfolioItem.delete({ where: { id } });
  revalidatePath("/dashboard/portfolio");
  revalidatePath(`/creators/${creator.id}`);
}
