"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { ownedCampaignOrThrow } from "@/lib/guards";
import { getSessionUser } from "@/lib/rbac";
import {
  feeSplit,
  getPlatformSetting,
  extractSettleInput,
  settleCampaignPayment,
  isUniqueViolation,
  isCampaignFundable,
  FUNDING_BLOCKED_MESSAGE,
} from "@/lib/payments";

/**
 * Validate a configured base URL and strip trailing slash(es).
 * Returns null unless the value is an absolute http(s) URL, so a blank or
 * malformed env var can never silently produce a relative redirect target.
 */
function normalizeBaseUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null; // not absolute / unparseable
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const path = url.pathname.replace(/\/+$/, ""); // keep any base path, drop trailing slash
  return `${url.origin}${path}`;
}

/**
 * Last-resort origin derived from the incoming request (proxy headers first,
 * then the raw Host header). Lets a preview/prod deploy work even when
 * NEXT_PUBLIC_APP_URL / AUTH_URL are unset.
 */
function originFromRequestHeaders(): string | null {
  let host: string | null = null;
  let proto: string | null = null;
  try {
    const h = headers();
    host = h.get("x-forwarded-host") ?? h.get("host"); // appropriate host fallback
    proto = h.get("x-forwarded-proto");
  } catch {
    return null; // outside a request scope
  }
  const firstHost = host?.split(",")[0]?.trim();
  if (!firstHost) return null;
  const firstProto = proto?.split(",")[0]?.trim();
  const scheme = firstProto || (/^(localhost|127\.0\.0\.1)(:|$)/.test(firstHost) ? "http" : "https");
  return normalizeBaseUrl(`${scheme}://${firstHost}`);
}

/**
 * Absolute origin for Stripe return URLs. Stripe rejects relative URLs, so we
 * fail loudly here instead of handing it "/dashboard/...".
 */
function resolveAppBaseUrl(): string {
  const base =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.AUTH_URL) ??
    originFromRequestHeaders();
  if (!base) {
    throw new Error(
      "Cannot determine the application URL for Stripe Checkout. Set NEXT_PUBLIC_APP_URL (or AUTH_URL) to an absolute https:// URL.",
    );
  }
  return base;
}

/**
 * Brand-initiated campaign funding (Step 3, TEST MODE).
 *
 * NOTE: this creates a Stripe Checkout Session only. It NEVER marks anything
 * paid — confirmation arrives exclusively via the verified webhook.
 *
 * Concurrency (two tabs / double click) is defended in four layers:
 *   L1 DB uniqueness   — Payment.campaignId @unique makes a 2nd row impossible
 *   L2 Reuse session   — an existing OPEN session is reused, never duplicated
 *   L3 Idempotency key — Stripe returns the SAME session for the same key
 *   L4 Webhook backstop— a 2nd distinct charge is flagged, never a 2nd earning
 */
export async function createCampaignCheckout(formData: FormData) {
  const { brand, campaign } = await ownedCampaignOrThrow(String(formData.get("campaignId") ?? "")); // ownership enforced
  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_NOT_CONNECTED");

  // ---- BUSINESS RULES (authoritative, server-side) ----
  // Decision #4 Option B: a creator must be selected, so money never enters the
  // platform without a known payee. Plus: a COMPLETED campaign is terminal and
  // closed to new funding. A positive budget is required.
  const fundable = isCampaignFundable({
    status: campaign.status,
    selectedCreatorId: campaign.selectedCreatorId,
    budgetCents: campaign.budgetCents,
  });
  if (!fundable.ok) throw new Error(FUNDING_BLOCKED_MESSAGE[fundable.reason!]);

  // Amount comes from the DB only — never from the browser.
  const gross = campaign.budgetCents!;

  const setting = await getPlatformSetting();
  const feeBps = setting.platformFeeBps;
  const { feeCents } = feeSplit(gross, feeBps);

  // ---- L1: atomic anchor row (created BEFORE any Stripe object) ----
  let payment = await prisma.payment.findUnique({ where: { campaignId: campaign.id } });
  if (payment?.status === "PAID") throw new Error("This campaign is already funded.");
  if (!payment) {
    try {
      payment = await prisma.payment.create({
        data: {
          kind: "CAMPAIGN",
          status: "PENDING",
          amountCents: gross,
          currency: setting.currency,
          userId: brand.userId,
          campaignId: campaign.id,
          platformFeeBps: feeBps, // snapshot — later fee changes never alter this payment
          platformFeeCents: feeCents,
          idempotencyKey: `cmp_${campaign.id}_v1`,
        },
      });
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      payment = await prisma.payment.findUnique({ where: { campaignId: campaign.id } }); // concurrent request won
      if (!payment) throw e;
    }
  }

  // If the budget changed since the row was created, re-sync the pending amount.
  if (payment.status !== "PAID" && payment.amountCents !== gross) {
    payment = await prisma.payment.update({
      where: { id: payment.id },
      data: { amountCents: gross, platformFeeBps: feeBps, platformFeeCents: feeCents },
    });
  }

  // ---- L2: reuse an existing session rather than minting a rival one ----
  // NOTE: redirect() works by throwing, so it must be called OUTSIDE the
  // try/catch — otherwise the catch would swallow it and we'd create a rival
  // session, defeating this layer entirely.
  let reuseUrl: string | null = null;
  if (payment.stripeCheckoutSessionId) {
    let existing: { status: string | null; url: string | null } | null = null;
    try {
      const s = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId);
      existing = { status: s.status ?? null, url: s.url ?? null };
    } catch {
      existing = null; // not retrievable — fall through and create a fresh session
    }
    if (existing?.status === "open" && existing.url) reuseUrl = existing.url;
    else if (existing?.status === "complete") reuseUrl = `/dashboard/campaigns/${campaign.id}?funding=confirming`;
    // "expired" ⇒ reuseUrl stays null ⇒ a fresh session is created below
  }
  if (reuseUrl) redirect(reuseUrl);

  const base = resolveAppBaseUrl(); // absolute, no trailing slash
  // ---- L3: deterministic idempotency key ----
  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: payment.currency,
            unit_amount: gross,
            product_data: { name: `Campaign: ${campaign.title}`.slice(0, 250) },
          },
        },
      ],
      metadata: { campaignId: campaign.id, paymentId: payment.id },
      payment_intent_data: { metadata: { campaignId: campaign.id, paymentId: payment.id } },
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 60 minutes
      success_url: `${base}/dashboard/campaigns/${campaign.id}?funding=confirming`,
      cancel_url: `${base}/dashboard/campaigns/${campaign.id}?funding=canceled`,
    },
    { idempotencyKey: payment.idempotencyKey ?? `cmp_${campaign.id}_v1` },
  );

  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PROCESSING", stripeCheckoutSessionId: session.id },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  redirect(session.url);
}

/**
 * RECOVERY PATH (case N): Stripe succeeded but our DB never recorded it
 * (lost/failed webhook). Re-reads the truth FROM STRIPE and runs the same
 * idempotent settlement used by the webhook. Safe to run repeatedly.
 *
 * Authorized for the owning brand or an ADMIN. It cannot invent a payment:
 * if Stripe does not report the session as paid, nothing changes.
 */
export async function reconcileCampaignPayment(formData: FormData) {
  const campaignId = String(formData.get("campaignId") ?? "");
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId }, include: { brand: true, payment: true } });
  if (!campaign) throw new Error("Campaign not found");
  const isOwner = user.role === "BRAND" && campaign.brand.userId === user.id;
  if (!isOwner && user.role !== "ADMIN") throw new Error("FORBIDDEN");

  const stripe = getStripe();
  if (!stripe) throw new Error("STRIPE_NOT_CONNECTED");
  const payment = campaign.payment;
  if (!payment?.stripeCheckoutSessionId) return; // nothing to reconcile
  if (payment.status === "PAID") return;

  const session = await stripe.checkout.sessions.retrieve(payment.stripeCheckoutSessionId);
  if (session.payment_status !== "paid") return; // Stripe says not paid ⇒ we change nothing

  // Reuse the webhook's exact settlement logic, in one transaction.
  const pseudoEvent = {
    id: `reconcile_${session.id}`,
    type: "checkout.session.completed",
    data: { object: session },
  } as unknown as Parameters<typeof extractSettleInput>[0];

  const input = extractSettleInput(pseudoEvent);
  if (!input) return;

  await prisma.$transaction(async (tx) => {
    await settleCampaignPayment(tx, input);
  });

  revalidatePath(`/dashboard/campaigns/${campaignId}`);
}
