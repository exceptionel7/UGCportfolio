import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";

/**
 * POST /api/forgot-password { email }
 * Always returns ok (does not reveal whether the email exists).
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = z.object({ email: z.string().email() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: true }); // don't leak

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (user) {
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { email, token, expires: new Date(Date.now() + 1000 * 60 * 30) },
    });
    await sendPasswordResetEmail(email, token);
  }

  return NextResponse.json({ ok: true });
}
