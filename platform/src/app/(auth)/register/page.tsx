"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthShell } from "@/components/AuthShell";

const ROLES = [
  { key: "CUSTOMER", icon: "🛍️", label: "Shopper", desc: "Buy products, digital goods & courses" },
  { key: "CREATOR", icon: "🎬", label: "Creator", desc: "Get hired for UGC & build a portfolio" },
  { key: "BRAND", icon: "🏷️", label: "Brand", desc: "Hire creators & launch campaigns" },
];

function RegisterInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [role, setRole] = useState(params.get("role")?.toUpperCase() || "CUSTOMER");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name")),
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      role,
    };
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setLoading(false);
      setError(data.error || "Could not create account");
      return;
    }
    if (!data.emailVerificationSent) {
      setNotice("Account created. Email verification is not connected yet, so you can log in directly.");
    }
    const login = await signIn("credentials", { email: payload.email, password: payload.password, redirect: false });
    setLoading(false);
    if (login?.error) setError("Account created, but automatic login failed. Please log in.");
    else router.push("/dashboard");
  }

  return (
    <AuthShell title="Join Exceptionel" subtitle="Turn attention into income. Choose how you'll use Exceptionel.">
      <div className="grid gap-2 mb-4">
        {ROLES.map((r) => (
          <button
            type="button"
            key={r.key}
            onClick={() => setRole(r.key)}
            className={`card p-3 flex items-center gap-3 text-left ${role === r.key ? "!border-fuchsia-500/60" : ""}`}
            style={role === r.key ? { background: "var(--grad-soft)" } : undefined}
          >
            <span className="text-2xl">{r.icon}</span>
            <div>
              <p className="font-semibold text-sm">{r.label}</p>
              <p className="text-xs text-zinc-500">{r.desc}</p>
            </div>
          </button>
        ))}
      </div>
      <form onSubmit={onSubmit} className="grid gap-3">
        <input className="field" name="name" placeholder="Name / company" required autoComplete="name" />
        <input className="field" type="email" name="email" placeholder="Email" required autoComplete="email" />
        <input className="field" type="password" name="password" placeholder="Create a password (min 8 chars)" required minLength={8} autoComplete="new-password" />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        {notice && <p className="text-xs text-amber-300">{notice}</p>}
        <button className="btn btn-primary w-full mt-1" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
      </form>
      <p className="text-sm text-zinc-400 text-center mt-4">
        Already have an account? <Link href="/login" className="text-gradient font-semibold">Log in</Link>
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterInner />
    </Suspense>
  );
}
