/**
 * Refund hold for creator payouts — offline tests (no database, no node_modules).
 *
 *   npm test                      → tsx --test tests/*.test.mts
 *   node --experimental-strip-types --test tests/payout-refund-hold.test.mts
 *
 * WHY THESE TESTS READ SOURCE INSTEAD OF IMPORTING IT
 * payments.ts imports "server-only", @prisma/client and "@/..." aliases, which
 * cannot load without a generated Prisma client and a Next server environment.
 * Rather than restructure production code, these tests:
 *
 *  1. FILTER SEMANTICS — read the UNREFUNDED_PAYMENT_WHERE object literal from
 *     payments.ts and evaluate it against in-memory payments, using a small
 *     evaluator that implements ONLY the Prisma operators the filter uses.
 *     Unknown operators/fields throw, so reshaping the filter fails loudly
 *     instead of passing silently. Caveat: this verifies the filter under our
 *     reading of Prisma's semantics, not Prisma itself (see the todo list).
 *
 *  2. WIRING — source-level checks that both payout actions and the admin page
 *     still apply the filter, and that the refund data it depends on is still
 *     written. Weaker than behavioural tests; they catch the filter being
 *     removed or bypassed.
 *
 * Cases that need a real database are registered as test.todo at the bottom.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), "utf8");

const PAYMENTS = read("lib/payments.ts");
const PAYOUT_ACTIONS = read("lib/actions/payouts.ts");
const ADMIN_PAGE = read("app/admin/payouts/page.tsx");

/** Text of a top-level function, from its signature up to the next top-level declaration. */
function fnBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  if (start < 0) throw new Error(`"${signature}" not found — update this test`);
  const rest = source.slice(start + signature.length);
  const next = rest.search(/\n(export )?(async )?function |\n\/\*\*|\nexport const /);
  return source.slice(start, start + signature.length + (next < 0 ? rest.length : next));
}

/* ------------------------------------------------------------------ */
/* Load the REAL filter from payments.ts                               */
/* ------------------------------------------------------------------ */

type Refund = { status: string };
type Payment = { status: string; refundedCents: number; refunds: Refund[] };

function loadFilter(): Record<string, unknown> {
  const m = PAYMENTS.match(/export const UNREFUNDED_PAYMENT_WHERE: Prisma\.PaymentWhereInput = (\{[\s\S]*?\n\});/);
  if (!m) throw new Error("UNREFUNDED_PAYMENT_WHERE not found in payments.ts — update this test's loader");
  return new Function(`return (${m[1]});`)() as Record<string, unknown>;
}
const FILTER = loadFilter();

/* ------------------------------------------------------------------ */
/* Minimal evaluator for the Prisma operators the filter uses          */
/* ------------------------------------------------------------------ */

function matchScalar(value: unknown, cond: unknown): boolean {
  if (cond === null || typeof cond !== "object" || Array.isArray(cond)) return value === cond;
  return Object.entries(cond as Record<string, unknown>).every(([op, arg]) => {
    if (op === "in") return (arg as unknown[]).includes(value);
    if (op === "notIn") return !(arg as unknown[]).includes(value);
    if (op === "equals") return value === arg;
    throw new Error(`evaluator: unsupported scalar operator "${op}" — extend the evaluator deliberately`);
  });
}

function matchRefund(refund: Refund, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([field, cond]) => {
    if (field === "status") return matchScalar(refund.status, cond);
    throw new Error(`evaluator: unsupported Refund field "${field}"`);
  });
}

function matchPayment(payment: Payment, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([field, cond]) => {
    if (field === "status" || field === "refundedCents") return matchScalar(payment[field], cond);
    if (field === "refunds") {
      return Object.entries(cond as Record<string, unknown>).every(([op, sub]) => {
        if (op === "none") return !payment.refunds.some((r) => matchRefund(r, sub as Record<string, unknown>));
        throw new Error(`evaluator: unsupported list operator "${op}"`);
      });
    }
    throw new Error(`evaluator: unsupported Payment field "${field}"`);
  });
}

/** Earning-level `payment: { is: FILTER }` on an optional relation: no payment never matches. */
const isPayable = (payment: Payment | null): boolean => payment !== null && matchPayment(payment, FILTER);

const pay = (over: Partial<Payment> = {}): Payment => ({ status: "PAID", refundedCents: 0, refunds: [], ...over });

/* ------------------------------------------------------------------ */
/* 1. Filter semantics                                                 */
/* ------------------------------------------------------------------ */

describe("UNREFUNDED_PAYMENT_WHERE — filter semantics", () => {
  test("clean PAID payment is payable", () => {
    assert.equal(isPayable(pay()), true);
  });

  test("case 1: status REFUNDED is held", () => {
    assert.equal(isPayable(pay({ status: "REFUNDED", refundedCents: 1000 })), false);
  });

  test("case 1: status PARTIALLY_REFUNDED is held (any partial refund holds the whole earning)", () => {
    assert.equal(isPayable(pay({ status: "PARTIALLY_REFUNDED", refundedCents: 1 })), false);
  });

  test("case 1: refundedCents > 0 alone is held", () => {
    assert.equal(isPayable(pay({ refundedCents: 1 })), false);
  });

  test("case 2: overwrite scenario — status reset to PAID but refundedCents > 0 → still held", () => {
    assert.equal(isPayable(pay({ status: "PAID", refundedCents: 1000 })), false);
  });

  test("case 2: overwrite scenario — status PAID, refundedCents 0, but a SUCCEEDED Refund row → still held", () => {
    assert.equal(isPayable(pay({ refunds: [{ status: "SUCCEEDED" }] })), false);
  });

  test("case 1: a PENDING Refund row is held", () => {
    assert.equal(isPayable(pay({ refunds: [{ status: "PENDING" }] })), false);
  });

  test("case 3: FAILED and CANCELED Refund rows do not block", () => {
    assert.equal(isPayable(pay({ refunds: [{ status: "FAILED" }] })), true);
    assert.equal(isPayable(pay({ refunds: [{ status: "CANCELED" }] })), true);
    assert.equal(isPayable(pay({ refunds: [{ status: "FAILED" }, { status: "CANCELED" }] })), true);
  });

  test("case 3: one SUCCEEDED row among failed ones still holds", () => {
    assert.equal(isPayable(pay({ refunds: [{ status: "FAILED" }, { status: "SUCCEEDED" }] })), false);
  });

  test("case 7: an earning with no payment is never payable", () => {
    assert.equal(isPayable(null), false);
  });

  test("the filter is refund-only: it does not judge other payment statuses (ELIGIBLE already required PAID)", () => {
    // Documents intent: payability on non-refund statuses is decided upstream
    // by markEarningEligible, not by this filter.
    assert.equal(isPayable(pay({ status: "PROCESSING" })), true);
  });

  test("the evaluator rejects operators it does not implement (guards against silent passes)", () => {
    assert.throws(() => matchPayment(pay(), { refundedCents: { gt: 0 } }), /unsupported scalar operator "gt"/);
    assert.throws(() => matchPayment(pay(), { refunds: { some: {} } }), /unsupported list operator "some"/);
  });
});

/* ------------------------------------------------------------------ */
/* 2. Batch selection (createPayoutForCreator's `payable` predicate)   */
/* ------------------------------------------------------------------ */

type Earning = { id: string; status: string; payoutId: string | null; netCents: number; payment: Payment | null };

/** Mirrors `payable` in createPayoutForCreator: ELIGIBLE, unbatched, unrefunded payment. */
const selectPayable = (earnings: Earning[]) =>
  earnings.filter((e) => e.status === "ELIGIBLE" && e.payoutId === null && isPayable(e.payment));

describe("payout batch selection", () => {
  const earnings: Earning[] = [
    { id: "clean", status: "ELIGIBLE", payoutId: null, netCents: 850, payment: pay() },
    { id: "full_refund", status: "ELIGIBLE", payoutId: null, netCents: 425, payment: pay({ status: "REFUNDED", refundedCents: 500 }) },
    { id: "partial_refund", status: "ELIGIBLE", payoutId: null, netCents: 300, payment: pay({ status: "PARTIALLY_REFUNDED", refundedCents: 50 }) },
    { id: "overwritten", status: "ELIGIBLE", payoutId: null, netCents: 999, payment: pay({ refundedCents: 1000 }) },
    { id: "failed_refund_only", status: "ELIGIBLE", payoutId: null, netCents: 1275, payment: pay({ refunds: [{ status: "FAILED" }] }) },
    { id: "no_payment", status: "ELIGIBLE", payoutId: null, netCents: 100, payment: null },
    { id: "already_batched", status: "ELIGIBLE", payoutId: "po_1", netCents: 50, payment: pay() },
    { id: "pending_earning", status: "PENDING", payoutId: null, netCents: 70, payment: pay() },
  ];

  test("case 4: a mixed set yields only clean, unbatched ELIGIBLE earnings", () => {
    assert.deepEqual(selectPayable(earnings).map((e) => e.id), ["clean", "failed_refund_only"]);
  });

  test("case 4: the batch total is the clean net only", () => {
    assert.equal(selectPayable(earnings).reduce((t, e) => t + e.netCents, 0), 850 + 1275);
  });

  test("case 5 (selection part): only refunded earnings → nothing selectable", () => {
    assert.equal(selectPayable(earnings.filter((e) => e.id.includes("refund") && e.id !== "failed_refund_only")).length, 0);
  });

  test("case 11 (selection part): eligible and held lists partition unbatched ELIGIBLE earnings", () => {
    const unbatched = earnings.filter((e) => e.status === "ELIGIBLE" && e.payoutId === null);
    const eligible = unbatched.filter((e) => isPayable(e.payment)).map((e) => e.id);
    const held = unbatched.filter((e) => !isPayable(e.payment)).map((e) => e.id);
    assert.deepEqual([...eligible, ...held].sort(), unbatched.map((e) => e.id).sort());
    assert.equal(eligible.some((id) => held.includes(id)), false);
    assert.deepEqual(held.sort(), ["full_refund", "no_payment", "overwritten", "partial_refund"]);
  });
});

/* ------------------------------------------------------------------ */
/* 3. Wiring (source-level)                                            */
/* ------------------------------------------------------------------ */

describe("wiring — the filter is applied where money can be released", () => {
  const create = fnBody(PAYOUT_ACTIONS, "export async function createPayoutForCreator");
  const markPaid = fnBody(PAYOUT_ACTIONS, "export async function markPayoutPaid");

  test("payments.ts exports the filter as a Prisma.PaymentWhereInput", () => {
    assert.match(PAYMENTS, /export const UNREFUNDED_PAYMENT_WHERE: Prisma\.PaymentWhereInput =/);
  });

  test("case 10: both actions still call requireAdmin() first", () => {
    for (const body of [create, markPaid]) {
      const firstStatement = body.slice(body.indexOf("{") + 1).trim().split("\n")[0].trim();
      assert.equal(firstStatement, "await requireAdmin();");
    }
  });

  test("case 1: createPayoutForCreator selects with the filter", () => {
    assert.match(create, /const payable = \{[^}]*payment: \{ is: UNREFUNDED_PAYMENT_WHERE \}/);
    assert.match(create, /tx\.earning\.findMany\(\{\s*where: payable,/);
  });

  test("case 6: the claim reuses the same predicate (a refund landing mid-build changes the count)", () => {
    assert.match(create, /tx\.earning\.updateMany\(\{\s*where: \{ \.\.\.payable, id: \{ in: /);
    assert.match(create, /if \(count !== earnings\.length\)/);
  });

  test("case 8: markPayoutPaid refuses before settling if any attached earning is refunded", () => {
    const guard = markPaid.indexOf("payment: { is: UNREFUNDED_PAYMENT_WHERE }");
    const check = markPaid.indexOf("if (payable !== attached)");
    const settle = markPaid.indexOf('status: "PAID", paidAt: new Date()');
    assert.ok(guard > 0 && check > guard, "refund guard missing");
    assert.ok(settle > check, "the refund guard must run before the payout is marked PAID");
    assert.match(markPaid.slice(check, settle), /throw new Error\(/);
  });

  test("case 8: the two counts run sequentially on the transaction client (no Promise.all)", () => {
    const attached = markPaid.indexOf("const attached = await tx.earning.count({ where: { payoutId } });");
    const payable = markPaid.indexOf("const payable = await tx.earning.count({ where: { payoutId, payment: { is: UNREFUNDED_PAYMENT_WHERE } } });");
    assert.ok(attached > 0, "attached count missing or reshaped");
    assert.ok(payable > attached, "payable count must follow the attached count");
    assert.doesNotMatch(markPaid, /Promise\.all/);
  });

  test("case 11: admin page filters the eligible list and shows a Held card", () => {
    assert.match(ADMIN_PAGE, /where: \{ status: "ELIGIBLE", payoutId: null, payment: \{ is: UNREFUNDED_PAYMENT_WHERE \} \}/);
    assert.match(ADMIN_PAGE, /NOT: \{ payment: \{ is: UNREFUNDED_PAYMENT_WHERE \} \}/);
    assert.match(ADMIN_PAGE, /Held: funding payment refunded or missing/);
  });

  test("the refund signals the filter relies on are still written by recordRefundForReview", () => {
    const record = fnBody(PAYMENTS, "export async function recordRefundForReview");
    assert.match(record, /tx\.refund\.create\(/);
    assert.match(record, /refundedCents: refunded/);
  });

  test("settlement never resets refundedCents (why the filter checks it, not just status)", () => {
    const settle = fnBody(PAYMENTS, "export async function settleCampaignPayment");
    assert.doesNotMatch(settle, /refundedCents/);
  });
});

/* ------------------------------------------------------------------ */
/* 4. Regression: fee split unchanged                                  */
/* ------------------------------------------------------------------ */

describe("regression", () => {
  test("case 12 (fee part): feeSplit is unchanged — $10 @ 1500 bps → $1.50 fee, $8.50 net", () => {
    const body = fnBody(PAYMENTS, "export function feeSplit").replace(/^export /, "").replace(/: number/g, "");
    const feeSplit = new Function(`${body}\nreturn feeSplit;`)() as (g: number, b: number) => { feeCents: number; netCents: number };
    assert.deepEqual(feeSplit(1000, 1500), { feeCents: 150, netCents: 850 });
  });
});

/* ------------------------------------------------------------------ */
/* 5. Needs a real database (not runnable offline)                     */
/* ------------------------------------------------------------------ */

describe("needs a database", () => {
  test.todo("case 1/4: createPayoutForCreator end-to-end skips refunded earnings; payout amount = clean net only");
  test.todo("case 5: only refunded earnings → throws, and no Payout row is created");
  test.todo("case 6: a refund recorded between select and claim → count mismatch → whole payout rolled back");
  test.todo("case 8: markPayoutPaid on a payout with a refunded earning → rejected; payout stays PENDING, earning stays ELIGIBLE");
  test.todo("case 9: markPayoutFailed releases the earnings; the refunded one stays out of the next batch");
  test.todo("case 10: clean payouts still work end-to-end; a non-admin is rejected by requireAdmin");
  test.todo("case 11: /admin/payouts renders the Held card and excludes held earnings from the eligible total");
  test.todo("Prisma interprets `payment: { is }`, `refunds: { none }` and `notIn` exactly as the evaluator above assumes");
  test.todo("case 12: earlier PR #3/#5 lifecycle cases (eligibility, late settlement, APPROVED gate) against a real DB");
});
