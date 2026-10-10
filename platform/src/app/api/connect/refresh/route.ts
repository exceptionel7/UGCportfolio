import { NextResponse } from "next/server";
import { requireCreator } from "@/lib/guards";
import { resolveAppBaseUrl } from "@/lib/app-url";
import { isConnectEnabled, createAccountOnboardingLink } from "@/lib/connect";

/**
 * Stripe `refresh_url` target.
 *
 * Account Links are single-use and expire; when Stripe sends the creator back
 * here we must mint a BRAND-NEW link rather than replaying a dead one.
 *
 * The creator is resolved from the signed session, so this can only ever
 * re-onboard the caller's own connected account.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { creator } = await requireCreator();
  const base = resolveAppBaseUrl();

  if (!isConnectEnabled() || !creator.stripeConnectAccountId) {
    return NextResponse.redirect(`${base}/dashboard/earnings?connect=unavailable`);
  }

  try {
    const url = await createAccountOnboardingLink(creator.stripeConnectAccountId);
    return NextResponse.redirect(url);
  } catch {
    // Never surface a raw Stripe error in a URL.
    return NextResponse.redirect(`${base}/dashboard/earnings?connect=error`);
  }
}
