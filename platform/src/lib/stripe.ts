import "server-only";
import Stripe from "stripe";

/**
 * Stripe access (Phases 8/9/10/11/13/14).
 * STATUS: NOT CONNECTED unless STRIPE_SECRET_KEY is set.
 * Returns null when no key exists so callers can degrade gracefully — an order
 * is NEVER marked paid without a verified Stripe webhook event.
 */
let _stripe: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!_stripe) _stripe = new Stripe(key); // uses account's default API version
  return _stripe;
}

export const stripeConnected = () => !!process.env.STRIPE_SECRET_KEY;
