"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthShell } from "@/components/AuthShell";

function ResetInner() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password: String(fd.get("password")) }),
    });
    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not reset password");
    } else {
      router.push("/login?reset=1");
    }
  }

  if (!token) {
    return (
      <AuthShell title="Reset link required">
        <p className="text-sm text-zinc-400">This page needs a valid reset link. <Link href="/forgot-password" className="text-gradient">Request one</Link>.</p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      <form onSubmit={onSubmit} className="grid gap-3">
        <input className="field" type="password" name="password" placeholder="New password (min 8 chars)" required minLength={8} autoComplete="new-password" />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="btn btn-primary w-full" disabled={loading}>{loading ? "Saving…" : "Update password"}</button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetInner />
    </Suspense>
  );
}
