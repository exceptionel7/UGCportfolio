import Link from "next/link";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen grid place-items-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-6">
          <span className="font-display font-bold text-2xl tracking-tight">
            Exception<span className="text-gradient">el</span>
          </span>
        </Link>
        <div className="card p-6 sm:p-8" style={{ background: "var(--ink-2)" }}>
          <h1 className="font-display font-bold text-2xl">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-400 mb-5 mt-1">{subtitle}</p>}
          {children}
        </div>
      </div>
    </main>
  );
}
