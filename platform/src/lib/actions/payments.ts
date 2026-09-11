"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { ownedCampaignOrThrow } from "@/lib/guards";
import { getSessionUser } from "@/lib/rbac";
import { feeSplit, getPlatformSetting, extractSettleInput, settleCampaignPayment, isUniqueViolation } from "@/lib/payments";

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

  // ---- BUSINESS RULE (Decision #4, Option B) ----
  // A campaign may only be funded once a creator is selected. This makes the
  // "funded but unmatched" state impossible, so money never enters the platform
  // without a known payee — important while refunds are still out of scope.
  if (!campaign.selectedCreatorId) {
    throw new Error("Select a creator before funding this campaign.");
  }

  // Amount comes from the DB only — never from the browser.
  const gross = campaign.budgetCents;
  if (!gross || gross <= 0) throw new Error("Set a campaign budget before funding.");

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

  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "";
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
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes
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
