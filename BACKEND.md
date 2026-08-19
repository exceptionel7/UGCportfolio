# Exceptionel — Backend Blueprint

This document specifies how to turn the current **client-side data layer**
(`assets/js/store.js`, persisting to `localStorage`) into a **real, shared,
multi-user backend** with secure auth, payments and email.

The frontend was built so this is a drop-in swap: every method on the global
`Store` object maps 1:1 to a REST endpoint. Replace the localStorage
implementation with `fetch()` calls to your API and the whole platform becomes
multi-user and persistent — no UI changes required.

> **Honesty note:** Today the app is fully functional **per browser/device**.
> It is *not* a shared database, auth is a local demo (passwords base64-encoded,
> not securely hashed on a server), and payments/email/TikTok Shop are **not**
> connected (clearly labeled everywhere). This file is the plan to make them real.

---

## Recommended stack

- **Framework:** Next.js (App Router) — deploys natively on Vercel (already hosting the site).
- **Database:** Postgres (Vercel Postgres, Supabase, or Neon) via **Prisma**.
- **Auth:** Auth.js (NextAuth) with credentials + OAuth; roles in JWT/session.
- **Payments:** Stripe (Checkout + Connect for creator payouts).
- **Email:** Resend or SendGrid (transactional + sequences).
- **File/media storage:** Vercel Blob, S3, or UploadThing (portfolio videos, product media, course files, digital downloads).

## Roles & permissions

`ADMIN · BRAND · CREATOR · CUSTOMER` — enforce on the server (middleware +
per-route checks). Users must only read/write data appropriate to their role
(e.g. a brand sees only its own campaigns; a creator sees only campaigns they're
assigned to or that are open).

---

## Data model (Prisma-style sketch)

```prisma
model User {         // roles: admin | brand | creator | customer
  id        String   @id @default(cuid())
  role      String
  name      String?
  email     String   @unique
  passwordHash String            // server-side hash (bcrypt/argon2) — NOT in client
  // brand
  website   String?
  about     String?
  // creator
  bio String?  location String?  languages String[]  niches String[]
  styles String[]  categories String[]  socials String?  rateFrom Int?
  portfolio Json?               // [{title, url, poster, kind}]
  createdAt DateTime @default(now())
}

model Campaign {
  id String @id @default(cuid())
  brandId String
  title String  product String?  productInfo String?  brief String?
  objective String?  numVideos Int  budget String?  deadline String?
  images String[]  status String   // Draft…Completed
  selectedCreatorId String?
  createdAt DateTime @default(now())
}

model Application { id String @id @default(cuid())  campaignId String  creatorId String  message String?  status String  createdAt DateTime @default(now()) }
model Deliverable { id String @id @default(cuid())  campaignId String  creatorId String  title String  note String?  fileUrl String?  status String  revisionNote String?  createdAt DateTime @default(now()) }
model Message     { id String @id @default(cuid())  campaignId String  fromId String  toId String  text String  createdAt DateTime @default(now()) }
model Order       { id String @id @default(cuid())  userId String?  items Json  total Int  info Json  createdAt DateTime @default(now()) }
model Payment     { id String @id @default(cuid())  userId String?  kind String  ref String  amount Int  status String  createdAt DateTime @default(now()) }
model Review      { id String @id @default(cuid())  productId String  userId String  rating Int  text String?  createdAt DateTime @default(now()) }
model Progress    { id String @id @default(cuid())  userId String  courseId String  done Int[]  completed Boolean }
model Coupon      { code String @id  percent Int  active Boolean }
model Notification{ id String @id @default(cuid())  userId String  type String  text String  read Boolean  createdAt DateTime @default(now()) }
model Subscriber  { id String @id @default(cuid())  firstName String?  email String @unique  createdAt DateTime @default(now()) }
// CMS content (stats, pricing, products, courses, blog, memberships…) → a Content table or headless CMS.
```

## Endpoint map (Store method → REST route)

| `Store` method | HTTP | Route |
|---|---|---|
| `signup` / `login` / `logout` / `currentUser` | POST/GET | `/api/auth/*` (Auth.js) |
| `updateProfile` | PATCH | `/api/users/me` |
| `creators` / `getUser` | GET | `/api/creators`, `/api/users/:id` |
| `createCampaign` / `updateCampaign` / `setStatus` / `publishCampaign` | POST/PATCH | `/api/campaigns` |
| `campaigns` / `openCampaigns` / `brandCampaigns` / `creatorCampaigns` | GET | `/api/campaigns?...` |
| `apply` / `applicationsFor` / `approveApplication` | POST/GET | `/api/campaigns/:id/applications` |
| `submitDeliverable` / `requestRevision` / `approveDeliverable` | POST | `/api/campaigns/:id/deliverables` |
| `completeCampaign` | POST | `/api/campaigns/:id/complete` (records payout) |
| `sendMessage` / `messagesFor` | POST/GET | `/api/campaigns/:id/messages` |
| `createOrder` / `userOrders` | POST/GET | `/api/orders` (via Stripe webhook) |
| `addReview` / `reviewsFor` | POST/GET | `/api/products/:id/reviews` |
| `enroll` / `toggleLesson` / `getProgress` | POST/GET | `/api/courses/:id/progress` |
| `coupons` / `saveCoupon` / `removeCoupon` | GET/POST/DELETE | `/api/coupons` |
| `notify` / `notifications` / `markAllRead` | GET/POST | `/api/notifications` |
| `emitEmail` | (server) | triggers Resend/SendGrid send |
| admin: `allUsers` / `stats` / `deleteUser` | GET/DELETE | `/api/admin/*` (ADMIN only) |

## Payments (Stripe)

- One-time: digital products, courses, shop orders → **Stripe Checkout**; fulfil on `checkout.session.completed` webhook → `createOrder`.
- Subscriptions: memberships (Free / Creator Pro / Brand Pro) → **Stripe Billing**.
- Creator payouts: **Stripe Connect** → replaces the demo "record payment" step.
- Secret keys live in **server env vars only**. The publishable key is the only client-exposed value.

## Email notifications (already wired as events)

`Store.emitEmail(...)` currently logs to `exc_email_log` (visible in Admin →
Email Log) and **never fakes delivery**. Connect a provider and send on these
events: new account · campaign application · creator selected · new campaign ·
new message · video submitted · revision requested · video approved · payment
received · order confirmation · digital purchase · course enrollment.

## TikTok Shop

`tiktok-shop.html` is built as a native-feeling storefront with a clearly
labeled "Not connected" placeholder. Integrate via the **official TikTok Shop /
affiliate API** and map products into the existing product/feed components.

## Environment variables (server-side)

```
DATABASE_URL=
AUTH_SECRET=
STRIPE_SECRET_KEY=            STRIPE_WEBHOOK_SECRET=      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
RESEND_API_KEY=               EMAIL_FROM=
BLOB_READ_WRITE_TOKEN=        # or S3_* credentials
TIKTOK_SHOP_APP_KEY=          TIKTOK_SHOP_APP_SECRET=
```

## Migration path (suggested order)

1. Stand up Postgres + Prisma; port the schema above.
2. Add Auth.js (email/password + OAuth) with roles; gate `/admin` and dashboards.
3. Replace `Store` internals with `fetch()` to the API routes (signatures already match).
4. Add Stripe Checkout + webhook → real orders/subscriptions/payouts.
5. Add Resend and fire on the `emitEmail` events.
6. Add media storage for portfolio/product/course uploads and signed digital downloads.
7. Connect TikTok Shop API.

Because the UI reads/writes exclusively through `Store`, steps 1–3 make the
entire platform genuinely multi-user with zero component rewrites.
