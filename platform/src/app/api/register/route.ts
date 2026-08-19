import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, isStrongEnough } from "@/lib/password";
import { sendVerificationEmail } from "@/lib/mail";

/**
 * POST /api/register
 * Creates a user with a securely hashed password.
 *
 * SECURITY: role is clamped to a public set. ADMIN can NEVER be created via
 * registration — that must be assigned server-side (see prisma/seed.ts). The
 * client's role value is never trusted beyond BRAND/CREATOR/CUSTOMER.
 */
const schema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
  role: z.enum(["BRAND", "CREATOR", "CUSTOMER"]).default("CUSTOMER"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 422 });
  }
  const { name, email, password, role } = parsed.data;
  if (!isStrongEnough(password)) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 422 });
  }

  const normEmail = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normEmail } });
  if (existing) {
    // Avoid leaking which emails exist beyond a generic conflict.
    return NextResponse.json({ error: "An account with that email already exists" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name,
      email: normEmail,
      passwordHash,
      role,
      profile: { create: {} },
      ...(role === "BRAND" ? { brand: { create: { companyName: name } } } : {}),
      ...(role === "CREATOR" ? { creator: { create: {} } } : {}),
    },
  });

  // Email verification token (used once email delivery is connected).
  const token = randomBytes(32).toString("hex");
  await prisma.emailVerificationToken.create({
    data: { email: normEmail, token, expires: new Date(Date.now() + 1000 * 60 * 60 * 24) },
  });
  const mail = await sendVerificationEmail(normEmail, token);

  return NextResponse.json({
    ok: true,
    userId: user.id,
    emailVerificationSent: mail.sent,
    emailStatus: mail.sent ? "sent" : mail.reason ?? "NOT_CONNECTED",
  });
}
