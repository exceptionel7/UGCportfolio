import "server-only";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { resolveAppBaseUrl } from "@/lib/app-url";
import type { Tx } from "@/lib/payments";

/**
 * Stripe Connect (Express) — platform side.
 *
 * MODEL: separate charges and transfers. The brand's Checkout payment lands in
 * the PLATFORM account (unchanged); paying a creator is a later, separate
 * Transfer from the platform balance to the creator's connected account.
 * Checkout is never converted to a destination charge.
 *
 * Stripe hosts all onboarding and KYC — Exceptionel never collects identity or
 * bank details, and never stores them.
 *
 * HONESTY RULES
 *  - No fake connected-account ids, ever.
 *  - payoutsEnabled is only ever written from Stripe's reported capabilities,
 *    never because a creator reached return_url.
 *  - When Connect is unavailable we degrade to a clear message, never a crash
 *    and never a pretend success.
 */

/** Application-level error codes (safe to surface to operators). */
export const CONNECT_NOT_ENABLED = "CONNECT_NOT_ENABLED";
export const CREATOR_PAYOUT_ACCOUNT_NOT_READY = "CREATOR_PAYOUT_ACCOUNT_NOT_READY";
export const CONNECT_UNAVAILABLE_MESSAGE = "Creator payout setup unavailable.";

/**
 * Can we attempt Connect operations at all? Uses the project's existing Stripe
 * key — no extra environment variable is introduced.
 *
 * NOTE: this cannot prove Connect is *enabled on the platform account* (that is
 * Stripe Dashboard state). If it is not, the first accounts.create call fails and
 * describeConnectError() maps it to CONNECT_UNAVAILABLE_MESSAGE.
 */
export function isConnectEnabled(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Best-effort classification of a Stripe error as "Connect isn't set up on this
 * platform account". Message matching is inherently fuzzy, so this is only used
 * to choose safe operator copy — never to decide money state.
 */
export function describeConnectError(err: unknown): { connectDisabled: boolean; safeMessage: string } {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lowered = raw.toLowerCase();
  const connectDisabled =
    lowered.includes("connect") &&
    (lowered.includes("not enabled") ||
      lowered.includes("signed up") ||
      lowered.includes("only stripe connect") ||
      lowered.includes("platform"));
  return {
    connectDisabled,
    safeMessage: connectDisabled ? CONNECT_UNAVAILABLE_MESSAGE : "Could not reach Stripe to set up payouts. Please try again.",
  };
}

/** Minimal shape we read off a Stripe Account — keeps readiness logic pure/testable. */
export type RawAccountShape = {
  id?: string | null;
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  capabilities?: { transfers?: string | null } | null;
  requirements?: { disabled_reason?: string | null; currently_due?: string[] | null } | null;
};

export type ConnectedAccountStatus = {
  accountId: string | null;
  transfersActive: boolean;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  disabledReason: string | null;
  currentlyDue: string[];
  /** The only flag that gates a transfer. */
  canReceiveTransfers: boolean;
};

/**
 * PURE mapping from Stripe account state to payout readiness.
 *
 * To RECEIVE a platform transfer the account needs `capabilities.transfers`
 * ACTIVE and no blocking requirement. `payouts_enabled` is a different thing
 * (the connected account paying out to its own bank) so it is reported but is
 * deliberately NOT the gate — otherwise a transferable account could be
 * wrongly blocked.
 *
 * "details_submitted" is likewise NOT sufficient: finishing the onboarding form
 * does not mean Stripe has approved transfers.
 */
export function deriveAccountReadiness(account: RawAccountShape): ConnectedAccountStatus {
  const transfersActive = account.capabilities?.transfers === "active";
  const disabledReason = account.requirements?.disabled_reason ?? null;
  return {
    accountId: account.id ?? null,
    transfersActive,
    payoutsEnabled: !!account.payouts_enabled,
    chargesEnabled: !!account.charges_enabled,
    detailsSubmitted: !!account.details_submitted,
    disabledReason,
    currentlyDue: account.requirements?.currently_due ?? [],
    canReceiveTransfers: transfersActive && !disabledReason,
  };
}

/**
 * Create an Express connected account for a creator.
 * Idempotency keyed to the creator, so a double-click cannot mint two accounts.
 */
export async function createExpressAccount(args: { creatorId: string; email?: string | null }): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error(CONNECT_NOT_ENABLED);

  const account = await stripe.accounts.create(
    {
      type: "express",
      email: args.email ?? undefined,
      capabilities: { transfers: { requested: true } }, // required to receive platform transfers
      metadata: { creatorId: args.creatorId },
    },
    { idempotencyKey: `connect_acct_${args.creatorId}` },
  );
  return account.id;
}

/**
 * Stripe-hosted onboarding link. Account Links are single-use and expire, so
 * this is called fresh every time — including from refresh_url.
 */
export async function createAccountOnboardingLink(accountId: string): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error(CONNECT_NOT_ENABLED);

  const base = resolveAppBaseUrl(); // shared canonical resolver — never hard-coded
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${base}/api/connect/refresh`,
    return_url: `${base}/dashboard/earnings?connect=return`,
    type: "account_onboarding",
  });
  return link.url;
}

/** Live Stripe account state. Returns null if the account cannot be retrieved. */
export async function getConnectedAccountStatus(accountId: string): Promise<ConnectedAccountStatus | null> {
  const stripe = getStripe();
  if (!stripe) return null;
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return deriveAccountReadiness(account as unknown as RawAccountShape);
  } catch {
    return null; // deleted/rejected/unreachable — caller decides, never assumes ready
  }
}

/**
 * Cache Stripe's verdict onto Creator.payoutsEnabled. Writes only when the value
 * actually changes. Resolves the creator from the STRIPE account id only.
 */
export async function syncCreatorPayoutsEnabled(accountId: string, canReceiveTransfers: boolean): Promise<boolean> {
  const { count } = await prisma.creator.updateMany({
    where: { stripeConnectAccountId: accountId, payoutsEnabled: { not: canReceiveTransfers } },
    data: { payoutsEnabled: canReceiveTransfers },
  });
  return count > 0;
}

/**
 * §11/§12 — apply a verified `account.updated` event.
 *
 * The creator is resolved ONLY from the Stripe account id in the signed event;
 * no client-supplied identifier is ever trusted. If no creator matches we log a
 * safe warning and mutate nothing — a webhook must never create a Creator.
 *
 * Runs inside the webhook transaction so it shares the WebhookEvent idempotency
 * guard. Reaching return_url plays no part in this: only Stripe's reported
 * capabilities can enable payouts.
 */
export async function applyAccountUpdate(
  tx: Tx,
  account: RawAccountShape,
): Promise<{ ok: boolean; reason?: string; payoutsEnabled?: boolean }> {
  const accountId = account.id ?? null;
  if (!accountId) return { ok: false, reason: "NO_ACCOUNT_ID" };

  const readiness = deriveAccountReadiness(account);

  const creator = await tx.creator.findFirst({
    where: { stripeConnectAccountId: accountId },
    select: { id: true, userId: true, payoutsEnabled: true },
  });
  if (!creator) {
    console.warn(`[connect:account.updated] no creator for account ${accountId}`);
    return { ok: false, reason: "NO_CREATOR" };
  }

  if (creator.payoutsEnabled === readiness.canReceiveTransfers) {
    return { ok: true, reason: "ALREADY_IN_SYNC", payoutsEnabled: readiness.canReceiveTransfers };
  }

  await tx.creator.updateMany({
    where: { stripeConnectAccountId: accountId, payoutsEnabled: { not: readiness.canReceiveTransfers } },
    data: { payoutsEnabled: readiness.canReceiveTransfers },
  });

  if (readiness.canReceiveTransfers && creator.userId) {
    await tx.notification.create({
      data: {
        userId: creator.userId,
        type: "payouts_enabled",
        body: "Your Stripe payout account is ready. Eligible earnings can now be paid out.",
      },
    });
  }

  return { ok: true, payoutsEnabled: readiness.canReceiveTransfers };
}

export type PayoutReadiness = {
  ok: boolean;
  reason?: "CONNECT_NOT_ENABLED" | "NO_CREATOR" | "NO_ACCOUNT" | "ACCOUNT_UNAVAILABLE" | "NOT_READY";
  accountId?: string | null;
  status?: ConnectedAccountStatus | null;
};

/**
 * Authoritative payout readiness for a creator.
 *
 * Deliberately consults STRIPE, not just the cached Creator.payoutsEnabled flag:
 * the column is application cache, Stripe is the source of truth. The cache is
 * refreshed as a side effect so the UI converges.
 */
export async function getCreatorPayoutReadiness(creatorId: string): Promise<PayoutReadiness> {
  if (!isConnectEnabled()) return { ok: false, reason: "CONNECT_NOT_ENABLED" };

  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    select: { id: true, stripeConnectAccountId: true, payoutsEnabled: true },
  });
  if (!creator) return { ok: false, reason: "NO_CREATOR" };
  if (!creator.stripeConnectAccountId) return { ok: false, reason: "NO_ACCOUNT", accountId: null };

  const status = await getConnectedAccountStatus(creator.stripeConnectAccountId);
  if (!status) {
    return { ok: false, reason: "ACCOUNT_UNAVAILABLE", accountId: creator.stripeConnectAccountId, status: null };
  }

  if (status.canReceiveTransfers !== creator.payoutsEnabled) {
    await syncCreatorPayoutsEnabled(creator.stripeConnectAccountId, status.canReceiveTransfers);
  }

  return {
    ok: status.canReceiveTransfers,
    reason: status.canReceiveTransfers ? undefined : "NOT_READY",
    accountId: creator.stripeConnectAccountId,
    status,
  };
}
