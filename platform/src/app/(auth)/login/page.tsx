"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { AuthShell } from "@/components/AuthShell";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") || "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: String(fd.get("email")),
      password: String(fd.get("password")),
      redirect: false,
    });
    setLoading(false);
    if (res?.error) setError("Invalid email or password");
    else router.push(callbackUrl);
  }

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your Exceptionel account.">
      {params.get("verified") && <p className="pill mb-4 !text-emerald-300">Email verified — you can log in.</p>}
      {params.get("forbidden") && <p className="pill mb-4 !text-amber-300">You don&apos;t have access to that area.</p>}
      <form onSubmit={onSubmit} className="grid gap-3">
        <input className="field" type="email" name="email" placeholder="Email" required autoComplete="email" />
        <input className="field" type="password" name="password" placeholder="Password" required autoComplete="current-password" />
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button className="btn btn-primary w-full mt-1" disabled={loading}>{loading ? "Logging in…" : "Log in"}</button>
      </form>
      <div className="flex justify-between mt-4 text-sm text-zinc-400">
        <Link href="/forgot-password" className="hover:text-white">Forgot password?</Link>
        <Link href="/register" className="text-gradient font-semibold">Create account</Link>
      </div>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
