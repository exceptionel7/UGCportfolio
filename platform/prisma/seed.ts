import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Seed script — run with `npm run db:seed`.
 * Creates the FIRST admin securely (from env) and the three membership tiers.
 * ADMIN is assigned here on the server — never via public registration.
 */
async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail.toLowerCase() },
      update: { role: "ADMIN", passwordHash, emailVerified: new Date() },
      create: { email: adminEmail.toLowerCase(), name: "Exceptionel Admin", role: "ADMIN", passwordHash, emailVerified: new Date() },
    });
    console.log(`✓ Admin ready: ${adminEmail}`);
  } else {
    console.warn("• Skipped admin seed — set ADMIN_EMAIL and ADMIN_PASSWORD to create the admin.");
  }

  const memberships = [
    { key: "FREE", name: "Free", priceCents: 0, features: ["Creator resources", "Blog access", "Basic guides"] },
    { key: "CREATOR_PRO", name: "Creator Pro", priceCents: 1900, features: ["Advanced UGC training", "Script library", "Hook library", "Templates", "Exclusive opportunities"] },
    { key: "BRAND_PRO", name: "Brand Pro", priceCents: 14900, features: ["Discounted UGC packages", "Priority production", "Content strategy", "Campaign management", "Creator access"] },
  ];
  for (const m of memberships) {
    await prisma.membership.upsert({ where: { key: m.key }, update: { name: m.name, priceCents: m.priceCents, features: m.features }, create: m });
  }
  console.log(`✓ Memberships seeded (${memberships.length})`);

  // ---- TEST accounts (Phase 13) — ONLY when SEED_TEST_ACCOUNTS=true ----
  // Clearly labeled as TEST. Never presented as real users. Do not enable in
  // a real production database you intend to keep clean.
  if (process.env.SEED_TEST_ACCOUNTS === "true") {
    const pw = await bcrypt.hash(process.env.TEST_PASSWORD || "TestPass123!", 12);
    const testers: { email: string; name: string; role: "ADMIN" | "BRAND" | "CREATOR" | "CUSTOMER" }[] = [
      { email: "admin-test@exceptionel.test", name: "TEST — Admin", role: "ADMIN" },
      { email: "brand-test@exceptionel.test", name: "TEST — Brand", role: "BRAND" },
      { email: "creator-test@exceptionel.test", name: "TEST — Creator", role: "CREATOR" },
      { email: "customer-test@exceptionel.test", name: "TEST — Customer", role: "CUSTOMER" },
    ];
    for (const t of testers) {
      const u = await prisma.user.upsert({
        where: { email: t.email },
        update: { role: t.role, passwordHash: pw, emailVerified: new Date() },
        create: { email: t.email, name: t.name, role: t.role, passwordHash: pw, emailVerified: new Date() },
      });
      if (t.role === "BRAND") await prisma.brand.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, companyName: "TEST Brand Co." } });
      if (t.role === "CREATOR") await prisma.creator.upsert({ where: { userId: u.id }, update: {}, create: { userId: u.id, bio: "TEST creator account", location: "Test City", niches: ["Beauty", "Tech"], languages: ["English"], categories: ["Product demo"] } });
    }
    console.log("✓ TEST accounts seeded (labeled 'TEST —'). Password: TEST_PASSWORD env or 'TestPass123!'.");
  } else {
    console.log("• Skipped TEST accounts (set SEED_TEST_ACCOUNTS=true to create them).");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
