/**
 * Issue #9 — the creator Earnings page must not present earnings whose funding
 * payment was refunded (or is missing) as payable.
 *
 *   npm test                      → tsx --test tests/*.test.mts
 *   node --experimental-strip-types --test tests/creator-earnings-held.test.mts
 *
 * Source-level checks only. The page needs Prisma, next-auth and the Next
 * server to render, so it is read as text rather than imported or rendered.
 * Rendering and the real Prisma query are registered as test.todo below.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAGE = readFileSync(fileURLToPath(new URL("../src/app/dashboard/earnings/page.tsx", import.meta.url)), "utf8");

const HELD_TEXT = "The funding payment for this campaign was refunded or can't be found, so these earnings are not payable.";

/**
 * The JSX block for the "On hold" card, from its condition to its closing `)}`
 * line, with JSX entities decoded so it can be compared with the rendered text.
 */
function heldCard(): string {
  const start = PAGE.indexOf("{held.length > 0 && (");
  if (start < 0) throw new Error("held card not found");
  const end = PAGE.indexOf("\n      )}", start);
  if (end < 0) throw new Error("end of held card not found");
  return PAGE.slice(start, end).replace(/&apos;/g, "'");
}

describe("creator Earnings — held earnings (issue #9)", () => {
  test("uses the shared refund filter from payments.ts (one definition with /admin/payouts)", () => {
    assert.match(PAGE, /import \{ sumNetCents, UNREFUNDED_PAYMENT_WHERE \} from "@\/lib\/payments";/);
  });

  test("held query: this creator only, PENDING and ELIGIBLE only, funding payment refunded or missing", () => {
    assert.ok(
      PAGE.includes(
        'where: { creatorId: creator.id, status: { in: ["PENDING", "ELIGIBLE"] }, NOT: { payment: { is: UNREFUNDED_PAYMENT_WHERE } } },',
      ),
      "held query missing or reshaped",
    );
  });

  test("the main earnings query is still scoped to the signed-in creator", () => {
    assert.match(PAGE, /const \{ creator \} = await requireCreator\(\);/);
    assert.match(PAGE, /prisma\.earning\.findMany\(\{\s*where: \{ creatorId: creator\.id \},/);
  });

  test("held earnings are excluded from the eligible and pending buckets", () => {
    assert.ok(PAGE.includes('const eligible = byStatus("ELIGIBLE").filter((e) => !isHeld(e));'), "eligible bucket not filtered");
    assert.ok(PAGE.includes('const pending = byStatus("PENDING").filter((e) => !isHeld(e));'), "pending bucket not filtered");
  });

  test("PAID earnings are never treated as held (history stays 'Paid out')", () => {
    assert.ok(PAGE.includes('const paid = byStatus("PAID");'));
    assert.doesNotMatch(PAGE, /status: \{ in: \[[^\]]*"PAID"/);
  });

  test("the 'Eligible for payout' and 'Pending completion' totals use the filtered buckets", () => {
    assert.match(PAGE, /Eligible for payout<\/p>\s*<p[^>]*>\{usd\(sumNetCents\(eligible\)\)\}/);
    assert.match(PAGE, /Pending completion<\/p>\s*<p[^>]*>\{usd\(sumNetCents\(pending\)\)\}/);
  });

  test("lifetime total excludes held amounts, with the approved caption", () => {
    assert.ok(PAGE.includes("const lifetime = sumNetCents([...paid, ...eligible, ...pending]);"));
    assert.doesNotMatch(PAGE, /const lifetime = [^;]*held/);
    assert.ok(PAGE.includes("Lifetime net earnings (excludes canceled and on hold)."));
  });

  test("row label: held earnings read 'On hold' before falling back to the status label", () => {
    assert.ok(PAGE.includes('{isHeld(e) ? "On hold" : EARNING_STATUS_LABEL[e.status] ?? e.status}'), "held row label missing or reshaped");
  });

  test("an 'On hold' card is shown only when something is held, with the approved title, total and text", () => {
    const card = heldCard();
    assert.match(card, />On hold</);
    assert.match(card, /\{usd\(sumNetCents\(held\)\)\}/);
    assert.ok(card.includes(HELD_TEXT), "card text differs from the approved wording");
  });

  test("the On hold card names no admin, support or next step", () => {
    assert.doesNotMatch(heldCard(), /admin|support|contact|review|retry|will be/i);
  });

  test("the page never says 'under review'", () => {
    assert.doesNotMatch(PAGE, /under review/i);
  });
});

describe("needs a database or a rendered page", () => {
  test.todo("Rendered /dashboard/earnings: a refunded ELIGIBLE earning shows 'On hold', is excluded from 'Eligible for payout' and Lifetime, and appears in the On hold card");
  test.todo("Rendered /dashboard/earnings: a refunded PENDING earning shows 'On hold' and is excluded from 'Pending completion' and Lifetime");
  test.todo("Rendered /dashboard/earnings: a PAID earning whose payment was later refunded still shows 'Paid out'");
  test.todo("Real Prisma: the held query (NOT payment is UNREFUNDED_PAYMENT_WHERE) matches refunded, partially refunded and payment-less earnings and nothing else");
});
