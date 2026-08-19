"use client";
import { useState } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    await fetch("/api/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: String(fd.get("email")) }),
    });
    setLoading(false);
    setDone(true);
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a reset link if an account exists.">
      {done ? (
        <div>
          <p className="text-sm text-zinc-300">If that email is registered, a reset link is on its way.</p>
          <p className="text-xs text-zinc-500 mt-2">Note: emails only send once an email provider is connected (Phase 12). Until then, no message is delivered.</p>
          <Link href="/login" className="btn btn-ghost w-full mt-5">Back to login</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="grid gap-3">
          <input className="field" type="email" name="email" placeholder="Your email" required />
          <button className="btn btn-primary w-full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
          <Link href="/login" className="text-sm text-zinc-400 hover:text-white text-center">Back to login</Link>
        </form>
      )}
    </AuthShell>
  );
}
