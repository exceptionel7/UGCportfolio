import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/rbac";
import { usd } from "@/lib/format";
import { inviteCreator } from "@/lib/actions/campaigns";

export const dynamic = "force-dynamic";

export default async function CreatorProfilePage({ params }: { params: { id: string } }) {
  const creator = await prisma.creator.findUnique({
    where: { id: params.id },
    include: { user: { select: { name: true, email: true } }, portfolio: { orderBy: { createdAt: "desc" } } },
  });
  if (!creator) redirect("/marketplace");

  const socials = (creator.socials as { raw?: string } | null)?.raw ?? "";
  const viewer = await getSessionUser();

  // Brand-only invite: fetch the viewing brand's campaigns to invite to.
  let brandCampaigns: { id: string; title: string }[] = [];
  if (viewer?.role === "BRAND") {
    const brand = await prisma.brand.findUnique({ where: { userId: viewer.id } });
    if (brand) brandCampaigns = await prisma.campaign.findMany({ where: { brandId: brand.id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } });
  }

  return (
    <div className="container-x py-10 max-w-4xl">
      <Link href="/marketplace" className="text-sm text-zinc-400 hover:text-white">← Marketplace</Link>

      <div className="card p-6 sm:p-8 mt-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <span className="w-20 h-20 rounded-2xl grid place-items-center font-bold text-white text-3xl shrink-0" style={{ background: "var(--grad)" }}>
            {(creator.user.name || creator.user.email || "?")[0]?.toUpperCase()}
          </span>
          <div className="flex-1">
            <h1 className="font-display font-bold text-3xl">{creator.user.name || "Creator"}</h1>
            <p className="text-zinc-400">{creator.location || "Location not set"}{creator.rateFromCents != null ? ` · from ${usd(creator.rateFromCents)}` : ""}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">{creator.niches.map((n) => <span key={n} className="pill text-[11px]">{n}</span>)}</div>
          </div>
        </div>
        {creator.bio && <p className="text-zinc-300 mt-6">{creator.bio}</p>}
        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          <div className="glass rounded-xl p-4"><p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Languages</p><p className="text-sm">{creator.languages.join(", ") || "—"}</p></div>
          <div className="glass rounded-xl p-4"><p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Categories</p><p className="text-sm">{creator.categories.join(", ") || "—"}</p></div>
          <div className="glass rounded-xl p-4"><p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Styles</p><p className="text-sm">{creator.styles.join(", ") || "—"}</p></div>
        </div>
        {socials && <p className="text-sm text-zinc-400 mt-4">Socials: {socials}</p>}
      </div>

      {/* Invite (brand only) */}
      {viewer?.role === "BRAND" && (
        <div className="card p-6 mt-6">
          <h2 className="font-semibold mb-3">Invite to a campaign</h2>
          {brandCampaigns.length === 0 ? (
            <p className="text-sm text-zinc-400">You have no campaigns yet. <Link href="/dashboard/campaigns/new" className="text-gradient">Create one →</Link></p>
          ) : (
            <form action={inviteCreator} className="flex flex-col sm:flex-row gap-2">
              <input type="hidden" name="creatorId" value={creator.id} />
              <select name="campaignId" className="field flex-1">
                {brandCampaigns.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              <button className="btn btn-primary btn-sm shrink-0">Invite to campaign</button>
            </form>
          )}
        </div>
      )}

      <h2 className="font-display font-bold text-2xl mt-8 mb-4">Portfolio</h2>
      {creator.portfolio.length === 0 ? (
        <div className="card p-8 text-center text-zinc-400">This creator hasn't uploaded portfolio items yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {creator.portfolio.map((p) => (
            <div key={p.id} className="card overflow-hidden">
              <div className="aspect-[9/16] bg-white/5 grid place-items-center overflow-hidden">
                {p.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.posterUrl || p.url} alt={p.title || "portfolio"} className="w-full h-full object-cover" />
                ) : (
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-zinc-300 text-sm underline">▶ Watch</a>
                )}
              </div>
              <div className="p-2"><p className="text-xs truncate">{p.title || p.category || "Clip"}</p></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
