import { requireBrand } from "@/lib/guards";
import { createCampaign } from "@/lib/actions/campaigns";

export default async function NewCampaignPage() {
  await requireBrand(); // brand-only, server-enforced
  return (
    <div className="max-w-2xl">
      <h1 className="font-display font-bold text-2xl mb-1">New campaign</h1>
      <p className="text-sm text-zinc-400 mb-6">Saved to PostgreSQL. Publish to open it to creators, or save as a draft.</p>
      <form action={createCampaign} className="card p-6 grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2"><label className="label">Campaign title</label><input className="field" name="title" required placeholder="e.g. Summer Serum Launch" /></div>
        <div><label className="label">Product</label><input className="field" name="product" placeholder="Product name" /></div>
        <div><label className="label">Objective</label><input className="field" name="objective" placeholder="Awareness, conversions…" /></div>
        <div><label className="label">Number of videos</label><input className="field" name="numVideos" type="number" min={1} defaultValue={1} /></div>
        <div><label className="label">Budget ($)</label><input className="field" name="budget" type="number" placeholder="400" /></div>
        <div><label className="label">Deadline</label><input className="field" name="deadline" type="date" /></div>
        <div className="sm:col-span-2"><label className="label">Brief / requirements</label><textarea className="field" name="brief" rows={4} placeholder="What should creators know? Key features, tone, do's & don'ts, required content type." /></div>
        <div className="sm:col-span-2 flex gap-2">
          <button className="btn btn-primary" name="intent" value="publish">Publish campaign</button>
          <button className="btn btn-ghost" name="intent" value="draft">Save as draft</button>
        </div>
      </form>
    </div>
  );
}
