import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { usd } from "@/lib/format";

export const dynamic = "force-dynamic";

type SP = { q?: string; niche?: string; category?: string; language?: string; location?: string; maxRate?: string };

export default async function MarketplacePage({ searchParams }: { searchParams: SP }) {
  // DB-driven: real creators only. No fabricated profiles.
  const creators = await prisma.creator.findMany({
    include: { user: { select: { name: true, email: true, image: true } }, _count: { select: { portfolio: true } } },
    orderBy: { createdAt: "desc" },
  });

  const uniq = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
  const allNiches = uniq(creators.flatMap((c) => c.niches));
  const allCategories = uniq(creators.flatMap((c) => c.categories));
  const allLanguages = uniq(creators.flatMap((c) => c.languages));
  const allLocations = uniq(creators.map((c) => c.location ?? ""));

  const q = (searchParams.q ?? "").toLowerCase();
  const maxRateCents = searchParams.maxRate ? Number(searchParams.maxRate) * 100 : null;

  const filtered = creators.filter((c) => {
    if (searchParams.niche && !c.niches.includes(searchParams.niche)) return false;
    if (searchParams.category && !c.categories.includes(searchParams.category)) return false;
    if (searchParams.language && !c.languages.includes(searchParams.language)) return false;
    if (searchParams.location && c.location !== searchParams.location) return false;
    if (maxRateCents != null && c.rateFromCents != null && c.rateFromCents > maxRateCents) return false;
    if (q) {
      const hay = `${c.user.name ?? ""} ${c.niches.join(" ")} ${c.bio ?? ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const sel = (name: keyof SP, label: string, opts: string[]) => (
    <div>
      <label className="label">{label}</label>
      <select name={name} defaultValue={searchParams[name] ?? ""} className="field">
        <option value="">All</option>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="container-x py-10">
      <header className="flex items-center justify-between mb-6">
        <Link href="/" className="font-display font-bold text-lg">Exception<span className="text-gradient">el</span></Link>
        <Link href="/dashboard" className="btn btn-ghost btn-sm">Dashboard</Link>
      </header>

      <h1 className="font-display font-bold text-3xl mb-2">Creator marketplace</h1>
      <p className="text-zinc-400 mb-6">Real creators from the database. Filter and open a profile to invite them to a campaign.</p>

      <form className="card p-5 grid sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-8 items-end" method="get">
        <div className="lg:col-span-2"><label className="label">Search</label><input className="field" name="q" defaultValue={searchParams.q ?? ""} placeholder="Name or niche" /></div>
        {sel("niche", "Niche", allNiches)}
        {sel("category", "Category", allCategories)}
        {sel("language", "Language", allLanguages)}
        {sel("location", "Location", allLocations)}
        <div><label className="label">Max rate ($)</label><input className="field" name="maxRate" type="number" defaultValue={searchParams.maxRate ?? ""} /></div>
        <div className="lg:col-span-6 flex gap-2">
          <button className="btn btn-primary btn-sm">Apply filters</button>
          <Link href="/marketplace" className="btn btn-ghost btn-sm">Clear</Link>
        </div>
      </form>

      {creators.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="font-semibold text-lg">No creators have joined yet</p>
          <p className="text-zinc-400 mt-2">As creators sign up and complete their profiles, they'll appear here.</p>
          <Link href="/register?role=CREATOR" className="btn btn-primary mt-5">Become a creator</Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-zinc-400">No creators match these filters.</div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <div key={c.id} className="card p-5">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full grid place-items-center font-bold text-white text-lg" style={{ background: "var(--grad)" }}>
                  {(c.user.name || c.user.email || "?")[0]?.toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.user.name || "Creator"}</p>
                  <p className="text-xs text-zinc-500 truncate">{c.location || "Location not set"}</p>
                </div>
              </div>
              {c.bio && <p className="text-sm text-zinc-400 mt-3 line-clamp-2">{c.bio}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {c.niches.slice(0, 3).map((n) => <span key={n} className="pill text-[11px]">{n}</span>)}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                <div><p className="font-display font-bold">{c._count.portfolio}</p><p className="text-[11px] text-zinc-500">Portfolio</p></div>
                <div><p className="font-display font-bold">{usd(c.rateFromCents)}</p><p className="text-[11px] text-zinc-500">From</p></div>
                <div><p className="font-display font-bold">{c.languages.length || "—"}</p><p className="text-[11px] text-zinc-500">Languages</p></div>
              </div>
              <Link href={`/creators/${c.id}`} className="btn btn-ghost btn-sm w-full mt-4">View creator</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
