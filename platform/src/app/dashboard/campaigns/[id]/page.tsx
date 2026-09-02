import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { usd, fmtDate, CAMPAIGN_STATUS_ORDER, CAMPAIGN_STATUS_LABEL } from "@/lib/format";
import {
  publishCampaign, selectCreator, rejectApplication, startProduction,
  submitDeliverable, requestRevision, approveDeliverable, completeCampaign, attachBrief,
} from "@/lib/actions/campaigns";
import { sendMessage } from "@/lib/actions/messages";
import { storageConnected } from "@/lib/storage";
import { FileUploader } from "@/components/FileUploader";

export default async function CampaignDetail({ params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const campaign = await prisma.campaign.findUnique({
    where: { id: params.id },
    include: {
      brand: { include: { user: { select: { id: true, name: true, email: true } } } },
      selectedCreator: { include: { user: { select: { id: true, name: true, email: true } } } },
      applications: {
        orderBy: { createdAt: "asc" },
        include: { creator: { include: { user: { select: { name: true, email: true } }, _count: { select: { portfolio: true } } } } },
      },
      deliverables: { orderBy: { createdAt: "desc" } },
      messages: { orderBy: { createdAt: "asc" }, include: { from: { select: { id: true, name: true } } } },
    },
  });
  if (!campaign) redirect("/dashboard/campaigns");

  const isBrand = user.role === "BRAND" && campaign.brand.userId === user.id;
  const isCreator = user.role === "CREATOR" && campaign.selectedCreator?.userId === user.id;
  const isAdmin = user.role === "ADMIN";
  if (!isBrand && !isCreator && !isAdmin) redirect("/dashboard?forbidden=1");

  const currentIdx = CAMPAIGN_STATUS_ORDER.indexOf(campaign.status);
  const canMessage = (isBrand || isCreator) && !!campaign.selectedCreatorId;
  const canUpload = storageConnected();

  return (
    <div>
      <Link href="/dashboard/campaigns" className="text-sm text-zinc-400 hover:text-white">← Campaigns</Link>

      {/* Header */}
      <div className="card p-5 mt-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display font-bold text-2xl">{campaign.title}</h1>
            <p className="text-sm text-zinc-500">
              {campaign.product ? `${campaign.product} · ` : ""}{campaign.numVideos} video(s) · budget {usd(campaign.budgetCents)} · due {fmtDate(campaign.deadline)}
            </p>
          </div>
          <span className="pill text-[11px]">{CAMPAIGN_STATUS_LABEL[campaign.status]}</span>
        </div>
        {campaign.brief && <p className="text-sm text-zinc-400 mt-3">{campaign.brief}</p>}
        {campaign.objective && <p className="text-xs text-zinc-500 mt-1">Objective: {campaign.objective}</p>}
        {isBrand && campaign.status === "DRAFT" && (
          <form action={publishCampaign} className="mt-4">
            <input type="hidden" name="id" value={campaign.id} />
            <button className="btn btn-primary btn-sm">Publish (open to creators)</button>
          </form>
        )}
        {campaign.briefFileUrl && (
          <a href={campaign.briefFileUrl} target="_blank" rel="noreferrer" className="inline-block mt-3 text-sm text-gradient">📎 Open brief attachment ↗</a>
        )}
      </div>

      {/* Brand: attach a brief file */}
      {isBrand && (
        <section className="mt-4">
          <div className="card p-4">
            <p className="font-semibold text-sm mb-2">Brief attachment {campaign.briefFileUrl ? "· attached ✓" : ""}</p>
            <form action={attachBrief} className="grid gap-2">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <FileUploader name="briefUrl" scope="brief" campaignId={campaign.id} storageConfigured={canUpload} accept="application/pdf,image/*" label="Upload brief (PDF/image) or paste a URL" />
              <button className="btn btn-ghost btn-sm justify-self-start">Attach brief</button>
            </form>
          </div>
        </section>
      )}

      {/* Status tracker */}
      <div className="card p-4 mt-4 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-[680px]">
          {CAMPAIGN_STATUS_ORDER.map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              {i > 0 && <span className={`w-6 h-px ${i <= currentIdx ? "bg-fuchsia-500" : "bg-white/10"}`} />}
              <span className={`pill text-[10px] ${i <= currentIdx ? "" : "opacity-40"}`}>{CAMPAIGN_STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Brand: applications */}
      {(isBrand || isAdmin) && (
        <section className="mt-6">
          <h2 className="font-semibold mb-2">Applications ({campaign.applications.length})</h2>
          {campaign.applications.length === 0 ? (
            <div className="card p-6 text-zinc-400 text-sm">No applications yet.</div>
          ) : (
            <div className="grid gap-2">
              {campaign.applications.map((a) => (
                <div key={a.id} className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{a.creator.user.name || a.creator.user.email}</p>
                      <p className="text-xs text-zinc-500">{a.creator.location || "—"} · {a.creator._count.portfolio} portfolio item(s) · from {usd(a.creator.rateFromCents)}</p>
                    </div>
                    {a.status === "APPROVED" ? (
                      <span className="text-sm text-emerald-400">Selected ✓</span>
                    ) : a.status === "REJECTED" ? (
                      <span className="text-xs text-zinc-500">Not selected</span>
                    ) : isBrand && !campaign.selectedCreatorId ? (
                      <div className="flex gap-2">
                        <Link href={`/creators/${a.creatorId}`} className="btn btn-ghost btn-sm">View</Link>
                        <form action={rejectApplication}><input type="hidden" name="applicationId" value={a.id} /><button className="btn btn-ghost btn-sm">Reject</button></form>
                        <form action={selectCreator}><input type="hidden" name="applicationId" value={a.id} /><button className="btn btn-primary btn-sm">Select</button></form>
                      </div>
                    ) : (
                      <Link href={`/creators/${a.creatorId}`} className="btn btn-ghost btn-sm">View</Link>
                    )}
                  </div>
                  {a.message && <p className="text-sm text-zinc-400 mt-2">{a.message}</p>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Creator: production + submit */}
      {isCreator && (
        <section className="mt-6">
          <h2 className="font-semibold mb-2">Your work</h2>
          {campaign.status === "CREATOR_SELECTED" && (
            <form action={startProduction} className="mb-3">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <button className="btn btn-ghost btn-sm">Mark as “In production”</button>
            </form>
          )}
          {["CREATOR_SELECTED", "IN_PRODUCTION", "REVISION_REQUESTED"].includes(campaign.status) && (
            <form action={submitDeliverable} className="card p-5 grid gap-3">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <div><label className="label">Title</label><input className="field" name="title" required placeholder="Hook A — Unboxing" /></div>
              <FileUploader name="fileUrl" scope="deliverable" campaignId={campaign.id} storageConfigured={canUpload} accept="video/*,image/*" label="Video — upload a file or paste a URL" />
              <div><label className="label">Note</label><textarea className="field" name="note" rows={2} placeholder="Anything the brand should know" /></div>
              <button className="btn btn-primary btn-sm justify-self-start">Submit for review</button>
            </form>
          )}
        </section>
      )}

      {/* Deliverables (both) */}
      {campaign.selectedCreatorId && (
        <section className="mt-6">
          <h2 className="font-semibold mb-2">Deliverables</h2>
          {campaign.deliverables.length === 0 ? (
            <div className="card p-6 text-zinc-400 text-sm">No deliverables submitted yet.</div>
          ) : (
            <div className="grid gap-2">
              {campaign.deliverables.map((d) => (
                <div key={d.id} className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-sm">{d.title}</p>
                      {d.fileUrl && <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-gradient">Open file ↗</a>}
                      {d.note && <p className="text-sm text-zinc-400 mt-1">{d.note}</p>}
                      {d.revisionNote && <p className="text-sm text-rose-400 mt-1">Revision: {d.revisionNote}</p>}
                    </div>
                    <span className="pill text-[11px]">{d.status}</span>
                  </div>
                  {isBrand && d.status !== "APPROVED" && (
                    <div className="flex flex-col sm:flex-row gap-2 mt-3">
                      <form action={requestRevision} className="flex gap-2 flex-1">
                        <input type="hidden" name="deliverableId" value={d.id} />
                        <input className="field flex-1" name="note" placeholder="What to revise" />
                        <button className="btn btn-ghost btn-sm shrink-0">Request revision</button>
                      </form>
                      <form action={approveDeliverable}><input type="hidden" name="deliverableId" value={d.id} /><button className="btn btn-primary btn-sm">Approve</button></form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {isBrand && campaign.status === "APPROVED" && (
            <form action={completeCampaign} className="card p-4 mt-3 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-sm">Complete campaign</p>
                <p className="text-xs text-zinc-500">Marks it complete & notifies the creator. Payout occurs once payments are connected (NOT CONNECTED).</p>
              </div>
              <input type="hidden" name="id" value={campaign.id} />
              <button className="btn btn-primary btn-sm">Mark complete</button>
            </form>
          )}
        </section>
      )}

      {/* Messages */}
      {campaign.selectedCreatorId && (
        <section className="mt-6">
          <h2 className="font-semibold mb-2">Messages</h2>
          <div className="card p-4">
            <div className="grid gap-2 max-h-80 overflow-auto mb-3">
              {campaign.messages.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-4">No messages yet.</p>
              ) : (
                campaign.messages.map((m) => {
                  const mine = m.from.id === user.id;
                  return (
                    <div key={m.id} className={`max-w-[80%] ${mine ? "ml-auto" : ""}`}>
                      <div className="px-3 py-2 rounded-2xl text-sm" style={{ background: mine ? "var(--grad)" : "rgba(255,255,255,.06)", color: "#fff" }}>{m.body}</div>
                      <p className={`text-[11px] text-zinc-600 mt-0.5 ${mine ? "text-right" : ""}`}>{new Date(m.createdAt).toLocaleTimeString()}</p>
                    </div>
                  );
                })
              )}
            </div>
            {canMessage ? (
              <form action={sendMessage} className="flex gap-2">
                <input type="hidden" name="campaignId" value={campaign.id} />
                <input className="field flex-1" name="body" placeholder="Type a message…" autoComplete="off" required />
                <button className="btn btn-primary btn-sm">Send</button>
              </form>
            ) : (
              <p className="text-xs text-zinc-500">{isAdmin ? "Admins can view but not post in campaign threads." : ""}</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
