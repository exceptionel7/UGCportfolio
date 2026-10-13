/**
 * Issue #8 — a refunded payment must never be reset to PAID (or FAILED).
 * Source-level checks only (no database, no node_modules):
 *
 *   npm test                      → tsx --test tests/*.test.mts
 *   node --experimental-strip-types --test tests/refund-status-guards.test.mts
 *
 * payments.ts and actions/payments.ts import "server-only", Prisma and "@/..."
 * aliases, so they are read as text rather than imported. These checks pin the
 * guards' presence and order; the behaviour itself was verified with an
 * in-memory harness (see PR description). Cases needing a real database or
 * Stripe are registered as test.todo at the bottom.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");
const PAYMENTS = read("lib/payments.ts");
const PAYMENT_ACTIONS = read("lib/actions/payments.ts");

/** Text of a top-level function, from its signature up to the next top-level declaration. */
function fnBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`"${signature}" not found — update this test`);
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\n(export )?(async )?function |\n\/\*\*|\nexport const /);
  return source.slice(start, start + signature.length + (next < 0 ? rest.length : next));
}

const REFUND_SAFE = '["PAID", "REFUNDED", "PARTIALLY_REFUNDED"]';

describe("settleCampaignPayment — settlement guard", () => {
  const settle = fnBody(PAYMENTS, "export async function settleCampaignPayment");

  test("the PAID transition excludes PAID, REFUNDED and PARTIALLY_REFUNDED", () => {
    assert.ok(
      settle.includes(`where: { id: payment.id, status: { notIn: ${REFUND_SAFE} } },`),
      "settlement guard missing or reshaped",
    );
  });

  test("the old PAID-only guard is gone", () => {
    assert.doesNotMatch(settle, /status: \{ not: "PAID" \}/);
  });

  test("the guard sits on the update that writes status PAID", () => {
    const guard = settle.indexOf(`status: { notIn: ${REFUND_SAFE} }`);
    const write = settle.indexOf('status: "PAID",');
    assert.ok(guard > 0 && write > guard && write - guard < 120, "guard is not on the PAID write");
  });

  test("there is exactly one Payment status write in settlement", () => {
    assert.equal((settle.match(/tx\.payment\.updateMany\(/g) ?? []).length, 1);
    assert.equal((settle.match(/status: "PAID"/g) ?? []).length, 1);
  });

  test("the duplicate-charge guard is unchanged and still runs before the update", () => {
    const dup = settle.indexOf(
      'if (payment.status === "PAID" && payment.stripePaymentIntentId && input.paymentIntentId && payment.stripePaymentIntentId !== input.paymentIntentId) {',
    );
    const dupReturn = settle.indexOf('return { ok: false, reason: "DUPLICATE_CHARGE" };');
    const update = settle.indexOf("await tx.payment.updateMany(");
    assert.ok(dup > 0, "duplicate-charge guard missing or reshaped");
    assert.ok(dupReturn > dup && update > dupReturn, "duplicate-charge guard must return before the status update");
  });

  test("the amount/currency check still runs before the update", () => {
    const mismatch = settle.indexOf("if (!sameAmount || !sameCurrency) {");
    const update = settle.indexOf("await tx.payment.updateMany(");
    assert.ok(mismatch > 0 && update > mismatch);
  });
});

describe("markPaymentFailed — never downgrades a paid or refunded payment", () => {
  const failed = fnBody(PAYMENTS, "export async function markPaymentFailed");

  test("the early return covers PAID, REFUNDED and PARTIALLY_REFUNDED", () => {
    assert.ok(failed.includes(`if (!payment || ${REFUND_SAFE}.includes(payment.status)) return;`), "markPaymentFailed guard missing or reshaped");
  });

  test("the guard runs before the FAILED write", () => {
    const guard = failed.indexOf(`${REFUND_SAFE}.includes(payment.status)`);
    const write = failed.indexOf('status: "FAILED"');
    assert.ok(guard > 0 && write > guard);
  });
});

describe("reconcileCampaignPayment — only PROCESSING or FAILED is reconciled", () => {
  const reconcile = fnBody(PAYMENT_ACTIONS, "export async function reconcileCampaignPayment");

  test("returns early unless the payment is PROCESSING or FAILED", () => {
    assert.ok(
      reconcile.includes('if (payment.status !== "PROCESSING" && payment.status !== "FAILED") return;'),
      "reconcile early-return missing or reshaped",
    );
  });

  test("the old PAID-only early return is gone", () => {
    assert.doesNotMatch(reconcile, /if \(payment\.status === "PAID"\) return;/);
  });

  test("the early return happens before Stripe is called and before settlement", () => {
    const guard = reconcile.indexOf('payment.status !== "PROCESSING" && payment.status !== "FAILED"');
    const retrieve = reconcile.indexOf("stripe.checkout.sessions.retrieve(");
    const settle = reconcile.indexOf("settleCampaignPayment(tx, input)");
    assert.ok(guard > 0 && retrieve > guard && settle > retrieve);
  });

  test("authorization still runs before the status check", () => {
    const auth = reconcile.indexOf('if (!isOwner && user.role !== "ADMIN") throw new Error("FORBIDDEN");');
    const guard = reconcile.indexOf('payment.status !== "PROCESSING"');
    assert.ok(auth > 0 && guard > auth);
  });
});

describe("needs a database or Stripe", () => {
  test.todo("Prisma applies `status: { notIn: [...] }` on the PaymentStatus enum as expected against Postgres");
  test.todo("Late checkout.session.completed / payment_intent.succeeded on a REFUNDED payment leaves status, paidAt and ids unchanged (real DB)");
  test.todo("Late payment_intent.payment_failed on a REFUNDED payment leaves it REFUNDED (real DB)");
  test.todo("Reconcile against real Stripe test mode: PROCESSING → PAID; FAILED with a paid session → PAID");
  test.todo("Stripe test mode: Checkout → PAID → refund → resend checkout.session.completed → stays REFUNDED, paidAt unchanged");
  test.todo("Stripe test mode: confirm a Checkout Session's payment_status after the charge is refunded");
  test.todo("Full regression of the verified Checkout → webhook → PAID → Earning PENDING flow on a deployed build");
});
