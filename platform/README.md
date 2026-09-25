# Exceptionel — Production Platform

Real Next.js (App Router) application that converts the Exceptionel prototype
into a secure, database-backed platform.

- **Auth:** Auth.js v5 (Credentials + optional Google), JWT sessions, bcrypt hashing
- **DB:** PostgreSQL + Prisma
- **Authorization:** server-side (middleware + layout guards + `lib/rbac`); roles `ADMIN | BRAND | CREATOR | CUSTOMER`
- **Integrations (added as keys are provided):** Stripe, Resend, Vercel Blob, TikTok Shop — all currently **NOT CONNECTED** and never faked.

## Structure
```
platform/
├── prisma/schema.prisma      All models (Phase 2)
├── prisma/seed.ts            Admin + memberships seed
├── src/lib/                  prisma, auth, auth.config, password, rbac, mail, stripe, storage
├── src/middleware.ts         Server-side route protection
└── src/app/
    ├── (auth)/               login, register, forgot-password, reset-password
    ├── api/                  auth/[...nextauth], register, verify-email, forgot/reset-password
    ├── dashboard/            role-aware, server-guarded
    ├── admin/                ADMIN-only, server-guarded
    └── page.tsx              home hero
```

See **SETUP.md** to install/migrate/deploy and **STATUS.md** for the honest,
per-phase build state. This app was written in a restricted sandbox and has not
been compiled there — first `npm install` + `next build` happens on your side.
