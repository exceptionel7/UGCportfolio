import "server-only";
import { headers } from "next/headers";

/**
 * Canonical application URL resolution — ONE definition, shared by every Stripe
 * return/redirect URL (Checkout success/cancel, Connect onboarding
 * refresh/return). Extracted from lib/actions/payments.ts unchanged: a
 * "use server" module may only export async functions, so these synchronous
 * helpers could not be imported from there, and duplicating the logic is
 * explicitly not allowed.
 *
 * Never hard-code localhost here — the fallback chain derives it.
 */

/**
 * Validate a configured base URL and strip trailing slash(es).
 * Returns null unless the value is an absolute http(s) URL, so a blank or
 * malformed env var can never silently produce a relative redirect target.
 */
export function normalizeBaseUrl(value?: string | null): string | null {
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
export function originFromRequestHeaders(): string | null {
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
export function resolveAppBaseUrl(): string {
  const base =
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.AUTH_URL) ??
    originFromRequestHeaders();
  if (!base) {
    throw new Error(
      "Cannot determine the application URL. Set NEXT_PUBLIC_APP_URL (or AUTH_URL) to an absolute https:// URL.",
    );
  }
  return base;
}
