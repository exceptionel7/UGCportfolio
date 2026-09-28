# Exceptionel Platform — Build Status (honest)

> ⚠️ Not built/verified in the Kiro sandbox (no npm/network/DB there). Status
> below reflects what the code implements. "VERIFIED" only after it runs on your
> deploy. Nothing external is faked.

## Phase status

| Phase | Area | Status |
|---|---|---|
| 1 | Security (bcrypt hashing, JWT sessions, server-side RBAC, protected /dashboard + /admin) | **CODE COMPLETE** — verify on deploy |
| 2 | PostgreSQL + Prisma schema (all models) | **CODE COMPLETE** — run `prisma migrate` |
| 3 | Auth (register, login, logout, forgot/reset password, email-verify flow, optional Google) | **CODE COMPLETE** — password reset/verify emails need Phase 12 |
| 4 | Creator platform (profile/portfolio/apply/submit/earnings) | **NOT STARTED** (next increment) |
| 5 | Brand platform (campaign create/review/approve) | **NOT STARTED** |
| 6 | Creator marketplace (DB-driven) | **NOT STARTED** |
| 7 | File storage (Vercel Blob) | **NOT CONNECTED** — guarded stub in `lib/storage.ts` |
| 8 | Stripe payments | **NOT CONNECTED** — guarded stub in `lib/stripe.ts` |
| 9 | Creator payouts (Stripe Connect) | **NOT STARTED / NOT CONNECTED** |
| 10 | Digital product delivery (signed URLs) | **NOT STARTED** |
| 11 | Paid course access | **NOT STARTED** |
| 12 | Email (Resend) | **NOT CONNECTED** — guarded stub in `lib/mail.ts` |
| 13 | E-commerce checkout | **NOT STARTED** (depends on Stripe) |
| 14 | Coupons at checkout | **SCHEMA ONLY** |
| 15 | Invoices | **SCHEMA ONLY** |
| 16 | TikTok Shop | **NOT CONNECTED** — placeholder only |
| 17 | Admin management modules | **PARTIAL** — secure read-only overview; write modules pending |
| 18 | Data migration | Strategy: start clean; do NOT import prototype localStorage/creds |
| 19 | Env vars | `.env.example` provided |
| 20 | Testing | Pending first deploy |

## Integration connection state
- **Database:** required; NOT provisioned by me — set `DATABASE_URL`.
- **Stripe payment processing is NOT currently live.**
- **Email sending is NOT live** (no Resend key).
- **File storage is NOT connected** (no Blob token).
- **TikTok Shop is NOT integrated** — interface/placeholder only.
- **Creator payouts NOT implemented/connected.**

## Data migration note (Phase 18)
Start production with a **clean database**. Do NOT trust or import the prototype's
`localStorage` records or demo credentials (base64 "passwords" are not valid
hashes and must never be imported). Real accounts are created fresh via secure
registration.


---

## Update — Phases 4–11 (creator/brand platform) CODE COMPLETE (NOT VERIFIED)

Built on the same Next.js + Prisma + Postgres + Auth.js app, PostgreSQL as source of truth (server actions + server components). NOT built/verified in sandbox.

- **Phase 4 Creator:** profile edit, portfolio (DB, URL now / upload when storage on), browse open campaigns, apply, applications list, assignments, submit deliverable, resubmit on revision, earnings (PAID payments only → $0).
- **Phase 5 Brand:** company profile, create/publish campaign, review applications, accept/reject, select creator, review deliverables, request revision, approve, complete.
- **Phase 6 Marketplace:** DB-driven, filters (niche/category/language/location/rate/search), empty state, public creator profile, brand "Invite to Campaign".
- **Phase 7 Campaign state machine:** DRAFT→OPEN→APPLICATIONS→CREATOR_SELECTED→IN_PRODUCTION→SUBMITTED→REVISION_REQUESTED→APPROVED→COMPLETED, every transition persisted.
- **Phase 8 Storage:** `/api/upload` + `lib/storage.ts`; returns STORAGE_NOT_CONFIGURED without a token; portfolio/deliverables accept real hosted URLs meanwhile.
- **Phase 9 Messaging:** per-campaign brand↔creator, persisted, participant-checked.
- **Phase 10 Notifications:** DB-backed + generated on all workflow events; notifications center + unread badge. Email NOT CONNECTED.
- **Phase 11 Admin:** overview + users (role change/delete) + campaigns; every mutation re-checks ADMIN server-side.
- **Phase 12 Security:** ownership guards (`requireCreator/requireBrand/ownedCampaignOrThrow/assignedCampaignOrThrow`) on every mutation.
- **Phase 13 Test data:** seed creates clearly-labeled `TEST —` accounts only when `SEED_TEST_ACCOUNTS=true`.

Payments/Email/Storage/TikTok remain **NOT CONNECTED**. Nothing here has been compiled or run — verify on deploy.
