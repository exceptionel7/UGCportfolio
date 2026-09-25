# Exceptionel Platform — Setup (Phases 1–3)

Production Next.js app: secure Auth.js authentication, PostgreSQL + Prisma,
server-verified role authorization. This app lives in `platform/` and is
**separate** from the existing static prototype (which keeps running on the
current Vercel project). Nothing here has been built or run inside the Kiro
sandbox — it must be installed, migrated and deployed in an environment with
network + a database (your machine / Vercel).

## 0. Prerequisites
- Node 18+ (20/22 recommended)
- A PostgreSQL database — Vercel Postgres, Neon, or Supabase

## 1. Install
```bash
cd platform
npm install        # runs `prisma generate` via postinstall
```

## 2. Environment
```bash
cp .env.example .env
```
Fill in at minimum (Phases 1–3):
- `DATABASE_URL` (and `DIRECT_URL` — same value if your DB isn't pooled)
- `AUTH_SECRET` → generate: `openssl rand -base64 32`
- `AUTH_URL` / `NEXT_PUBLIC_APP_URL` → `http://localhost:3000` for dev
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` → your first admin (for the seed)

Everything else (Stripe, Resend, Blob, Google, TikTok) can stay empty for now —
those features report **NOT CONNECTED** until you add keys in later phases.

## 3. Create the database schema
```bash
npx prisma migrate dev --name init      # local dev (creates + applies migration)
npm run db:seed                          # creates the admin + membership tiers
```
For production (Vercel), migrations run with:
```bash
npx prisma migrate deploy
```

## 4. Run locally
```bash
npm run dev        # http://localhost:3000
```
Verify:
- `/register` → create a Brand/Creator/Customer (ADMIN cannot be self-registered)
- `/login`, `/dashboard` (role-aware), `/admin` (only your seeded ADMIN)
- Log out, log back in from another browser → same account/data (real DB)

## 5. Deploy to Vercel
1. Create a **new** Vercel project pointing at this repo with **Root Directory = `platform`**
   (leave your existing static-site project untouched).
2. Add all `.env` values in **Settings → Environment Variables**
   (use the production `AUTH_URL`/`NEXT_PUBLIC_APP_URL`).
3. Add a Postgres integration (Vercel Postgres/Neon) → it sets `DATABASE_URL`.
4. Build command is `prisma generate && next build` (already in `package.json`).
5. After first deploy, run `prisma migrate deploy` (Vercel build hook or one-off) and `npm run db:seed`.

## Security guarantees already in place (Phase 1)
- Passwords hashed with **bcrypt** (`src/lib/password.ts`); never stored plaintext/base64.
- Sessions are **Auth.js JWTs**, signed with `AUTH_SECRET`.
- Role authorization is enforced **server-side** in `src/middleware.ts` + `src/lib/rbac.ts`
  + the `/dashboard` and `/admin` server layouts. Role comes only from the signed
  session — editing localStorage/JS cannot grant ADMIN.
- Registration clamps role to `BRAND|CREATOR|CUSTOMER`; ADMIN is seed-only.

If `npm install` or `next build` reports an error on your first run, send me the
log and I'll fix it — this code was written but could not be compiled in the
restricted sandbox.
