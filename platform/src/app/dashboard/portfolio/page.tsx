import { requireCreator } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { storageConnected } from "@/lib/storage";
import { addPortfolioItem, deletePortfolioItem } from "@/lib/actions/portfolio";
import { FileUploader } from "@/components/FileUploader";

export default async function PortfolioPage() {
  const { creator } = await requireCreator();
  const items = await prisma.portfolioItem.findMany({ where: { creatorId: creator.id }, orderBy: { createdAt: "desc" } });
  const canUpload = storageConnected();

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Portfolio</h1>
      <p className="text-sm text-zinc-400 mb-6">Items are stored in PostgreSQL. Add media by URL now; direct file uploads activate once storage is connected.</p>

      <div className="card p-4 mb-6 text-sm">
        <span className="pill">{canUpload ? "STORAGE: connected" : "STORAGE NOT CONFIGURED"}</span>
        {!canUpload && <span className="text-zinc-500 ml-3">Set <code>BLOB_READ_WRITE_TOKEN</code> to enable direct file uploads. Until then, paste a hosted media URL below (no fake uploads).</span>}
      </div>

      <form action={addPortfolioItem} className="card p-6 grid sm:grid-cols-2 gap-4 mb-8">
        <div><label className="label">Title</label><input className="field" name="title" placeholder="e.g. Beauty unboxing" /></div>
        <div><label className="label">Type</label>
          <select className="field" name="kind"><option value="VIDEO">Video</option><option value="IMAGE">Image</option></select>
        </div>
        <div className="sm:col-span-2"><FileUploader name="url" scope="portfolio" storageConfigured={canUpload} accept="image/*,video/*" label="Media — upload a file or paste a URL (required)" required /></div>
        <div><label className="label">Poster/thumbnail URL (optional)</label><input className="field" name="posterUrl" placeholder="https://" /></div>
        <div><label className="label">Category (optional)</label><input className="field" name="category" placeholder="Beauty, Tech…" /></div>
        <div className="sm:col-span-2"><button className="btn btn-primary">Add portfolio item</button></div>
      </form>

      {items.length ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map((it) => (
            <div key={it.id} className="card overflow-hidden">
              <div className="aspect-[9/16] bg-white/5 grid place-items-center overflow-hidden">
                {it.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.posterUrl || it.url} alt={it.title || "portfolio"} className="w-full h-full object-cover" />
                ) : (
                  <a href={it.url} target="_blank" rel="noreferrer" className="text-zinc-300 text-sm underline">▶ Open video</a>
                )}
              </div>
              <div className="p-3 flex items-center justify-between gap-2">
                <span className="text-xs truncate">{it.title || it.category || "Item"}</span>
                <form action={deletePortfolioItem}>
                  <input type="hidden" name="id" value={it.id} />
                  <button className="text-xs text-rose-400 hover:text-rose-300">Remove</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center text-zinc-400">No portfolio items yet.</div>
      )}
    </div>
  );
}
