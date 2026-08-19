import "server-only";

/**
 * File storage (Phase 7) — Vercel Blob.
 * STATUS: NOT CONNECTED unless BLOB_READ_WRITE_TOKEN is set.
 * Portfolio videos, campaign submissions, product/course media and digital
 * product files are stored here. Private files (digital products, lesson videos)
 * must be served via signed/temporary URLs — never linked directly.
 */
export const storageConnected = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export async function uploadPublic(pathname: string, data: Blob | Buffer | ArrayBuffer) {
  if (!storageConnected()) throw new Error("STORAGE_NOT_CONNECTED");
  const { put } = await import("@vercel/blob");
  return put(pathname, data, { access: "public" });
}

/**
 * For PRIVATE assets (digital downloads / paid lesson videos): store with a
 * private key and generate a short-lived signed URL at request time after
 * verifying the user's entitlement (Download / Enrollment record).
 * Implemented in Phase 10/11.
 */
export async function signedDownloadUrl(_key: string): Promise<string> {
  if (!storageConnected()) throw new Error("STORAGE_NOT_CONNECTED");
  throw new Error("NOT_IMPLEMENTED: signed download URLs are wired in Phase 10/11");
}
