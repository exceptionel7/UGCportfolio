import { requireCreator } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { usd, fmtDate, EARNING_STATUS_LABEL, PAYOUT_STATUS_LABEL } from "@/lib/format";
import { sumNetCents } from "@/lib/payments";
import { isConnectEnabled, getCreatorPayoutReadiness } from "@/lib/connect";
import { createCreatorConnectAccount } from "@/lib/actions/connect";

export const dynamic = "force-dynamic";

/**
 * Creator earnings + payout account.
 *
 * Amounts are creator NET, read from the Earning ledger, which is written only by
 * verified Stripe webhook settlement.
 *
 * Returning from Stripe onboarding proves nothing, so on every load with a
 * connected account we re-read LIVE Stripe state (which also re-caches
 * Creator.payoutsEnabled) instead of trusting the stored flag.
 *
 * Copy never claims a bank deposit — a transfer reaching the creator's Stripe
 * account is not the same as their bank receiving funds.
 */
export default async function EarningsPage({ searchParams }: { searchParams?: { connect?: string } }) {
  const { creator } = await requireCreator();
  const connectOn = isConnectEnabled();

  // Live readiness only when an account exists — avoids a Stripe call for
  // creators who have never started onboarding.
  const readiness = creator.stripeConnectAccountId && connectOn ? await getCreatorPayoutReadiness(creator.id) : null;
  const payoutReady = !!readiness?.ok;
  const hasAccount = !!creator.stripeConnectAccountId;
  const needsMoreInfo = !!readiness && !readiness.ok && (readiness.status?.currentlyDue.length ?? 0) > 0;

  const earnings = await prisma.earning.findMany({
    where: { creatorId: creator.id },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: { select: { id: true, title: true, status: true } },
      payout: { select: { id: true, status: true, paidAt: true } },
    },
  });

  const byStatus = (status: string) => earnings.filter((e) => e.status === status);
  const paid = byStatus("PAID");
  const eligible = byStatus("ELIGIBLE");
  const pending = byStatus("PENDING");
  const lifetime = sumNetCents([...paid, ...eligible, ...pending]);
  const processing = eligible.filter((e) => e.payout?.status === "PROCESSING");

  const notice =
    searchParams?.connect === "unavailable"
      ? "Payout setup is unavailable right now."
      : searchParams?.connect === "error"
        ? "We could not reach Stripe to continue onboarding. Please try again."
        : null;

  return (
    <div>
      <h1 className="font-display font-bold text-2xl mb-1">Earnings</h1>
      <p className="text-xs text-zinc-500">
        Your share after the platform fee. Recorded only from payments confirmed by a verified Stripe webhook.
      </p>

      {notice && <div className="card p-3 mt-3 text-xs text-amber-400">{notice}</div>}

      {/* ---- Payout account (§27) ---- */}
      <div className="card p-4 mt-3">
        {!connectOn ? (
          <>
            <p className="font-semibold text-sm">Payout account</p>
            <p className="text-xs text-zinc-500 mt-1">
              Payouts are <b>NOT CONNECTED</b> yet. Your eligible earnings are recorded and will be payable once payouts are enabled.
            </p>
          </>
        ) : !hasAccount ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-sm">Payout account setup required</p>
              <p className="text-xs text-zinc-500 mt-1">
                Connect your payout account to receive eligible earnings. Stripe handles verification — Exceptionel never sees your bank details.
              </p>
            </div>
            <form action={createCreatorConnectAccount}>
              <button type="submit" className="btn btn-primary btn-sm">Set up payouts</button>
            </form>
          </div>
        ) : payoutReady ? (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-sm">Payout account</p>
              <p className="text-xs text-emerald-400 mt-1">Connected — eligible earnings can be paid out.</p>
            </div>
            <span className="pill text-[11px]">Connected</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="font-semibold text-sm">Payout account — action needed</p>
              <p className="text-xs text-amber-400 mt-1">
                {needsMoreInfo
                  ? "Stripe still needs more information before transfers can be enabled."
                  : "Stripe has not yet enabled transfers for your account."}
              </p>
            </div>
            <form action={createCreatorConnectAccount}>
              <button type="submit" className="btn btn-sm">Continue setup</button>
            </form>
          </div>
        )}
      </div>

      <div className="card p-6 mt-3">
        <div className="font-display font-bold text-4xl text-gradient">{usd(lifetime)}</div>
        <p className="text-xs text-zinc-500 mt-2">Lifetime net earnings (excludes canceled).</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 mt-3">
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Paid out</p>
          <p className="font-display font-bold text-xl text-emerald-400">{usd(sumNetCents(paid))}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Eligible for payout</p>
          <p className="font-display font-bold text-xl">{usd(sumNetCents(eligible))}</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] uppercase tracking-wide text-zinc-500">Pending completion</p>
          <p className="font-display font-bold text-xl text-zinc-400">{usd(sumNetCents(pending))}</p>
        </div>
      </div>

      {processing.length > 0 && (
        <p className="text-xs text-zinc-400 mt-3">
          <b>Payout processing</b> — {usd(sumNetCents(processing))} has been sent to Stripe and is awaiting confirmation.
        </p>
      )}
      {eligible.length > processing.length && payoutReady && (
        <p className="text-xs text-zinc-500 mt-2">Your payout is ready to be processed.</p>
      )}

      <div className="mt-4">
        {earnings.length === 0 ? (
          <div className="card p-8 text-center text-zinc-400">
            No earnings yet. They appear once a brand funds a campaign you are selected for.
          </div>
        ) : (
          <div className="grid gap-2">
            {earnings.map((e) => {
              const payoutState = e.payout ? PAYOUT_STATUS_LABEL[e.payout.status] ?? e.payout.status : null;
              const label =
                e.status === "PAID"
                  ? "Paid to your Stripe payout account"
                  : e.payout?.status === "PROCESSING"
                    ? "Payout processing"
                    : EARNING_STATUS_LABEL[e.status] ?? e.status;
              return (
                <div key={e.id} className="card p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{e.campaign.title}</p>
                    <p className="text-xs text-zinc-500">
                      {fmtDate(e.createdAt)} · gross {usd(e.grossCents)} · fee {usd(e.feeCents)} ({e.feeBps / 100}%)
                      {e.eligibleAt ? ` · eligible ${fmtDate(e.eligibleAt)}` : ""}
                      {payoutState ? ` · payout ${payoutState}` : ""}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-1">{label}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={
                        "font-semibold " +
                        (e.status === "PAID" ? "text-emerald-400" : e.status === "CANCELED" ? "text-zinc-500 line-through" : "")
                      }
                    >
                      {usd(e.netCents)}
                    </span>
                    <p className="text-[11px] text-zinc-500">net</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
