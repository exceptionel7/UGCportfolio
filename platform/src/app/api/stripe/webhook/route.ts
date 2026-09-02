import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

/**
 * Stripe webhook endpoint (Step 2 — test-mode foundation).
 *
 * Responsibilities in THIS step only:
 *   1. Read the RAW request body (required for signature verification).
 *   2. Verify the `stripe-signature` header against STRIPE_WEBHOOK_SECRET.
 *      Unverified requests are rejected (400) — client/browser state is never trusted.
 *   3. Idempotency: record the Stripe event id in WebhookEvent (PK = event id).
 *      A duplicate delivery is a no-op, so nothing can ever be processed twice.
 *
 * It intentionally does NOT create/modify Payment, Earning, Payout or Refund
 * records yet — there is no checkout, so no real events to act on. Those
 * handlers are added in a later, separately-approved step.
 *
 * If Stripe keys are absent, returns 503 STRIPE_NOT_CONNECTED (never crashes,
 * never fakes a success).
 */
export const runtime = "nodejs"; // Stripe SDK requires Node, not the edge runtime
export const dynamic = "force-dynamic";

function summarize(event: Stripe.Event): string {
  const obj = event.data?.object as { id?: string } | undefined;
  return obj?.id ? `${event.type}:${obj.id}` : event.type;
}

export async function POST(req: Request) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "STRIPE_NOT_CONNECTED" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const rawBody = await req.text(); // raw payload — do not parse before verifying

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    // Invalid signature (or tampered payload) — reject.
    return NextResponse.json({ error: `Signature verification failed: ${(err as Error).message}` }, { status: 400 });
  }

  // Idempotency: the Stripe event id is the primary key. If it already exists,
  // this is a duplicate delivery — acknowledge without reprocessing.
  try {
    await prisma.webhookEvent.create({
      data: { id: event.id, type: event.type, payloadSummary: summarize(event) },
    });
  } catch {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Foundation only: recognized types are acknowledged but NOT acted upon yet.
  // Payment/earning/refund handling arrives with checkout (later step).
  switch (event.type) {
    case "checkout.session.completed":
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "charge.refunded":
    case "charge.dispute.created":
      // no-op in Step 2 (recorded for idempotency + audit)
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
