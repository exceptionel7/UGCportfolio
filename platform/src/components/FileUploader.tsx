"use client";
"use client";
import { useState } from "react";
import { upload } from "@vercel/blob/client";

/**
 * Phase 8 uploader. One controlled input (named `name`) is the single value the
 * surrounding server-action form submits:
 *   - the user can paste a hosted URL (fallback, always available), OR
 *   - pick a file which uploads directly to Vercel Blob and fills the input.
 * If storage isn't configured, only the URL fallback is shown — no fake upload.
 */
export function FileUploader({
  name,
  scope,
  campaignId,
  storageConfigured,
  accept = "image/*,video/*",
  label = "Media (upload or URL)",
  required = false,
}: {
  name: string;
  scope: "portfolio" | "deliverable" | "brief";
  campaignId?: string;
  storageConfigured: boolean;
  accept?: string;
  label?: string;
  required?: boolean;
}) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("uploading");
    setMsg(`Uploading ${file.name}…`);
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: JSON.stringify({ scope, campaignId: campaignId ?? null }),
      });
      setValue(blob.url); // confirmed by Vercel Blob — only now do we treat it as uploaded
      setStatus("done");
      setMsg(`Uploaded ✓ ${file.name}`);
    } catch (err) {
      setStatus("error");
      setMsg((err as Error).message || "Upload failed");
    }
  }

  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="field"
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="https://…  (or choose a file below)"
        required={required}
      />
      {storageConfigured ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input type="file" accept={accept} onChange={onFile} disabled={status === "uploading"} className="text-xs text-zinc-400" />
          {status === "uploading" && <span className="text-xs text-zinc-400">{msg}</span>}
          {status === "done" && <span className="text-xs text-emerald-400">{msg}</span>}
          {status === "error" && <span className="text-xs text-rose-400">{msg}</span>}
        </div>
      ) : (
        <p className="text-xs text-amber-300 mt-2">
          STORAGE NOT CONFIGURED — paste a hosted URL above. (Set <code>BLOB_READ_WRITE_TOKEN</code> to enable file uploads.)
        </p>
      )}
    </div>
  );
}
