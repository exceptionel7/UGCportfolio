import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import {
  extractSettleInput,
  settleCampaignPayment,
  markPaymentFailed,
  recordRefundForReview,
  isUniqueViolation,
} from "@/lib/payments";

/**
 * Stripe webhook (Step 3).
 *
 * 1. RAW body + `stripe-signature` verification (invalid ⇒ 400). Client state
 *    is never trusted; only Stripe-signed events can change money state.
 * 2. ATOMICITY: the WebhookEvent insert happens INSIDE the same transaction as
 *    the Payment/Earning writes. Therefore:
 *      • duplicate delivery  → PK conflict → whole tx rolls back → 200 {duplicate}
 *      • processing failure  → rollback, event NOT recorded → 500 → Stripe RETRIES
 *    (Recording the event before the work would silently swallow retries and
 *     leave a charged brand with no PAID record — deliberately avoided.)
 * 3. Handlers are idempotent, so a retry or a replay is always safe.
 *
 * Missing keys ⇒ 503 STRIPE_NOT_CONNECTED (never crashes, never fakes success).
 */
export const runtime = "nodejs"; // Stripe SDK needs Node, not edge
export const dynamic = "force-dynamic";

/**
 * Sentinel for "this Stripe event id was already processed".
 * Using a dedicated error type (instead of matching any P2002) ensures that a
 * unique-constraint conflict on some OTHER column — e.g. Payment.stripePaymentIntentId
 * — is never misreported as a duplicate delivery and silently swallowed with a 200.
 */
class DuplicateWebhookEvent extends Error {
  constructor(eventId: string) {
    super(`Duplicate Stripe event ${eventId}`);
    this.name = "DuplicateWebhookEvent";
  }
}

function summarize(event: Stripe.Event): string {
  // Same reasoning as extractSettleInput: cast the Stripe union via `unknown`.
  const obj = event.data?.object as unknown as { id?: string } | undefined;
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

  const rawBody = await req.text(); // raw payload — never parse before verifying

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    return NextResponse.json({ error: `Signature verification failed: ${(err as Error).message}` }, { status: 400 });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Idempotency guard participates in the SAME transaction. A P2002 HERE
        // (and only here) means this event id was already processed.
        try {
          await tx.webhookEvent.create({
            data: { id: event.id, type: event.type, payloadSummary: summarize(event) },
          });
        } catch (e) {
          if (isUniqueViolation(e)) throw new DuplicateWebhookEvent(event.id);
          throw e; // any other failure must surface as a 500 so Stripe retries
        }

        switch (event.type) {
          case "checkout.session.completed":
          case "payment_intent.succeeded": {
            const input = extractSettleInput(event);
            if (input) await settleCampaignPayment(tx, input);
            break;
          }
          case "payment_intent.payment_failed":
            await markPaymentFailed(tx, event);
            break;
          case "charge.refunded":
          case "charge.dispute.created":
            await recordRefundForReview(tx, event); // records + flags; earnings untouched
            break;
          default:
            break; // recorded for audit/idempotency only
        }
      },
      { timeout: 20000 },
    );
  } catch (e) {
    // ONLY a WebhookEvent-uniqueness conflict counts as a duplicate delivery.
    if (e instanceof DuplicateWebhookEvent) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Everything else — including a P2002 on any other unique column — is a real
    // failure. Nothing was committed; a non-2xx makes Stripe retry with backoff.
    console.error("[stripe:webhook] processing failed", event.id, event.type, e);
    return new NextResponse("processing failed", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
