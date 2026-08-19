import Link from "next/link";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  return (
    <main>
      <header className="container-x flex items-center justify-between h-[72px]">
        <span className="font-display font-bold text-xl">
          Exception<span className="text-gradient">el</span>
        </span>
        <nav className="flex items-center gap-3">
          {session?.user ? (
            <Link href="/dashboard" className="btn btn-primary" style={{ padding: ".6rem 1.05rem", fontSize: ".875rem" }}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost" style={{ padding: ".6rem 1.05rem", fontSize: ".875rem" }}>Log in</Link>
              <Link href="/register" className="btn btn-primary" style={{ padding: ".6rem 1.05rem", fontSize: ".875rem" }}>Sign up</Link>
            </>
          )}
        </nav>
      </header>

      <section className="container-x pt-16 sm:pt-24 pb-16">
        <span className="pill mb-6">Create. Promote. Sell. Grow.</span>
        <h1 className="font-display font-bold leading-[1.02]" style={{ fontSize: "clamp(2.6rem,6vw,4.7rem)", letterSpacing: "-0.02em" }}>
          Turn Attention <br className="hidden sm:block" />
          Into <span className="text-gradient">Income.</span>
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-xl">
          We create scroll-stopping UGC, short-form videos, and digital strategies that help creators and brands grow online.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register?role=BRAND" className="btn btn-primary">Hire a UGC Creator</Link>
          <Link href="/register?role=CREATOR" className="btn btn-ghost">Become a Creator</Link>
        </div>
        <p className="mt-10 text-xs text-zinc-500 max-w-2xl">
          This is the Exceptionel <b>production application</b> (secure auth + PostgreSQL). Marketing pages are being ported
          from the prototype; core account, campaign and commerce systems run on a real database and server-verified sessions.
        </p>
      </section>
    </main>
  );
}
