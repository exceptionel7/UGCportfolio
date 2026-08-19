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
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
