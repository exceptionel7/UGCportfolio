import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/rbac";
import { storageConnected, uploadPublic } from "@/lib/storage";

/**
 * POST /api/upload  (multipart form-data, field "file")
 * Real file storage endpoint (Phase 8).
 * Returns 501 STORAGE_NOT_CONFIGURED when no storage token is set — it never
 * pretends an upload happened. When Vercel Blob is configured, it stores the
 * file and returns its URL (caller then saves the URL in PostgreSQL).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!storageConnected()) {
    return NextResponse.json({ error: "STORAGE_NOT_CONFIGURED" }, { status: 501 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const key = `uploads/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const blob = await uploadPublic(key, Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({ url: blob.url });
}
