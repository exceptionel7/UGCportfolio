# Exceptionel — UGC + Short-Form Content & Commerce

**Create. Promote. Sell. Grow.** A premium, mobile-first website for a UGC content
creation, short-form video marketing, TikTok Shop and e-commerce business,
connecting **creators, brands and shoppers** in one cohesive ecosystem.

---

## Why this is a zero-build static site

This build runs with **no build step and no `node_modules`**. It uses:

- **Semantic HTML5** per page
- **Tailwind CSS** via the Play CDN + a small custom design system (`assets/css/theme.css`)
- **Google Fonts** — Space Grotesk (display) + Inter (body)
- **Vanilla JavaScript** for all interactivity

It works by simply opening `index.html` in a browser and is ready to host on any
static host (GitHub Pages, Netlify, Vercel, S3/CloudFront). This keeps it fast,
portable and immediately viewable.

## Run / preview

Any static server works. For example:

```bash
# Python
python3 -m http.server 8080
# then open http://localhost:8080
```

> Some features (localStorage, video viewer) work best over `http://` rather than `file://`.

---

## Project structure

```
exceptionel/
├── index.html              Homepage (hero, stats, services, process, pricing, portfolio, CTA)
├── ugc-services.html       UGC services + pricing tiers
├── for-brands.html         "Stop Scrolling. Start Selling." + brand campaign form
├── creators.html           Become a UGC creator + application form
├── creator-academy.html    Courses + memberships (Free / Creator Pro / Brand Pro)
├── digital-products.html   Downloadable products store
├── shop.html               Full store: search, category/price filters, wishlist, cart, checkout
├── tiktok-shop.html        "Shop Viral Finds" vertical-video interface
├── portfolio.html          Filterable portfolio + full-screen vertical video viewer
├── blog.html               Blog with categories, featured, search, newsletter
├── about.html              Brand story
├── contact.html            Role-based contact (Brands / Creators / Customers / Partnerships)
├── account.html            Customer / Creator / Brand dashboards
├── admin.html              Admin CMS — edit content with no code
├── legal.html              Privacy / Terms / Refund policy
├── robots.txt, sitemap.xml
└── assets/
    ├── css/theme.css       Design system (palette, animations, components)
    └── js/
        ├── data.js         ← CENTRAL EDITABLE CONTENT (single source of truth)
        ├── components.js   Shared nav, mobile drawer, footer, newsletter, toasts
        └── app.js          Cart, wishlist, counters, filters, video viewer, checkout, forms
```

## Editing content (no code)

All content lives in **`assets/js/data.js`** — stats, services, pricing, portfolio,
courses, digital products, shop products, blog posts and memberships.

The **admin dashboard (`admin.html`)** edits this content live: it saves overrides
to `localStorage` under `exc_overrides`, which `data.js` merges on top of the
defaults at load. You can edit statistics, pricing, memberships via forms, and any
structured section via a JSON editor — then "Reset to defaults" any time.

## Honesty / business rules honored

- **No fake testimonials, reviews, revenue or statistics.** Homepage counters are
  editable placeholders (show `—` until real numbers are entered in the admin).
  Product/review areas say "No reviews yet".
- **No faked integrations.** Payments, email, TikTok Shop, database, fulfilment and
  analytics are shown as **"Not connected"** placeholders, architected to connect to
  real services later.

## Connecting real backend / integrations

The frontend is structured so a backend can slot in without rework:

| Concern | Where it plugs in | Suggested service |
|---|---|---|
| Payments / checkout | `Checkout` in `app.js` → server endpoint | Stripe / PayPal |
| Auth & accounts | `account.html` role views | Auth provider + DB |
| CMS / content | `data.js` + `admin.html` overrides | DB + admin API |
| Email / newsletter | `[data-newsletter]` handler | Resend / Mailchimp |
| Form submissions | `[data-form]` handler (`exc_<key>`) | DB / CRM |
| TikTok Shop | `tiktok-shop.html` placeholder | Official TikTok Shop API |
| Analytics | add snippet in page `<head>` | GA4 / Plausible |

**Security:** keep all API keys and secrets in server-side environment variables.
Never expose private keys in frontend code.

## SEO

- Per-page `<title>`, meta description, canonical and Open Graph tags
- `Organization` / `Service` structured data (JSON-LD)
- `sitemap.xml` and `robots.txt` (admin/account marked `noindex` + disallowed)
- Clean, descriptive URLs

## Notes on assets

Product/portfolio/course thumbnails use branded gradient + emoji tiles instead of
stock photography, so the site is fully self-contained and has no broken images.
Swap in real imagery/video by adding `image`/`videoUrl` fields in `data.js`.


---

## Platform upgrade (v2) — the full Exceptionel ecosystem

Exceptionel is now a functioning multi-audience platform, not just a landing site.
It serves **brands, creators, shoppers and course/digital customers** with real,
working flows built on a backend-ready data layer.

### New capabilities

- **Accounts & roles** — sign up / log in as **Brand**, **Creator** or **Customer** (auth modal in the nav). Role-based dashboards at `account.html`. Admin at `admin.html`.
- **Brand dashboard** — create campaigns (brief, objective, #videos, budget, deadline), review applications, select creators, review deliverables, request revisions, approve, complete + record payment, message creators, company profile.
- **Creator dashboard** — profile (bio/location/languages/niches/rates/styles/socials), portfolio, browse & apply to campaigns, submit deliverables & revisions, earnings, messages.
- **Customer dashboard** — orders (with tracking), digital downloads, enrolled courses with progress, wishlist, addresses, payment history, profile.
- **Campaign workflow** — full status machine: `Draft → Open → Applications → Creator Selected → In Production → Submitted → Revision Requested → Approved → Completed`, with per-campaign brand↔creator messaging and event notifications.
- **Creator marketplace** (`marketplace.html`) — filter by category, location, language, price, content style; creator cards + public profiles (`creator.html?id=`); "Invite to Campaign". Populated by **real** creator sign-ups (honest empty state until then).
- **Service detail pages** (`service.html?slug=`) — explanation, examples, benefits, pricing, deliverables, turnaround, FAQ, CTA.
- **Product detail pages** (`product.html?id=`) — gallery + video slot, features, **real reviews** (logged-in customers only — none faked), related products, add to cart / buy now.
- **Courses** (`course.html?id=`) — 5 courses, lessons, progress tracking, completion, student dashboard access.
- **TikTok Shop hub** — Trending / Creator Picks / Viral Finds / New Arrivals (integration clearly marked "Not connected").
- **Admin** — live counts (accounts, campaigns, orders, reviews), manage users, campaigns, reviews, coupons, memberships, all CMS content, submissions, and an **email event log**.
- **Notifications** — in-app bell + panel; every notify also records an email **event** (see Admin → Email Log). Delivery is not faked.

### Architecture

- `assets/js/store.js` — the platform data layer: auth/session, all entities, notifications, and an email-event log. Persists to `localStorage` (`exc_db`). Every method maps 1:1 to a REST endpoint.
- Making it a **real, shared, multi-user backend** (Postgres + Prisma + Auth.js + Stripe + Resend) is a well-defined next step — see **`BACKEND.md`** for the schema, endpoint map, env vars and migration order.

### Honesty (per spec)

No fake users, reviews, earnings or statistics — everything populates from real
actions in the app. Payments, email delivery, TikTok Shop and a shared database
are shown as **integration points**, never faked as connected.
