"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCreator } from "@/lib/guards";
import {
  isConnectEnabled,
  createExpressAccount,
  createAccountOnboardingLink,
  describeConnectError,
  getCreatorPayoutReadiness,
  CONNECT_UNAVAILABLE_MESSAGE,
} from "@/lib/connect";

/**
 * CREATOR Connect onboarding actions.
 *
 * A creator may only ever operate on their OWN payout account: the creator is
 * resolved from the signed session via requireCreator(), never from form input.
 */

/**
 * Start (or resume) Stripe-hosted Express onboarding.
 *
 * Double-click safety is layered:
 *   L1 reuse      — an existing stripeConnectAccountId is always reused
 *   L2 Stripe key — accounts.create is idempotency-keyed per creator, so even a
 *                   true race returns the SAME account rather than a second one
 *   L3 guarded write — the id is persisted only where it is still null
 */
export async function createCreatorConnectAccount() {
  const { user, creator } = await requireCreator();
  if (!isConnectEnabled()) throw new Error(CONNECT_UNAVAILABLE_MESSAGE);

  let accountId = creator.stripeConnectAccountId;

  if (!accountId) {
    try {
      accountId = await createExpressAccount({ creatorId: creator.id, email: user.email });
    } catch (e) {
      throw new Error(describeConnectError(e).safeMessage); // never leak raw Stripe errors
    }
    await prisma.creator.updateMany({
      where: { id: creator.id, stripeConnectAccountId: null }, // guarded: a concurrent winner is kept
      data: { stripeConnectAccountId: accountId },
    });
    const fresh = await prisma.creator.findUnique({
      where: { id: creator.id },
      select: { stripeConnectAccountId: true },
    });
    accountId = fresh?.stripeConnectAccountId ?? accountId;
  }

  // redirect() throws, so it must run OUTSIDE the try/catch below.
  let onboardingUrl: string;
  try {
    onboardingUrl = await createAccountOnboardingLink(accountId);
  } catch (e) {
    throw new Error(describeConnectError(e).safeMessage);
  }

  revalidatePath("/dashboard/earnings");
  redirect(onboardingUrl); // only the hosted URL reaches the browser
}

/**
 * Pull fresh account state from Stripe and re-cache payoutsEnabled.
 * Used after returning from onboarding — reaching return_url proves nothing.
 */
export async function refreshCreatorPayoutStatus() {
  const { creator } = await requireCreator();
  await getCreatorPayoutReadiness(creator.id); // syncs the cached flag as a side effect
  revalidatePath("/dashboard/earnings");
}
