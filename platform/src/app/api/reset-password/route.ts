import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

/**
 * POST /api/reset-password { token, password }
 * Validates the reset token server-side and updates the bcrypt hash.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = z.object({ token: z.string().min(10), password: z.string().min(8).max(200) }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 422 });

  const { token, password } = parsed.data;
  const rec = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!rec || rec.expires < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or expired" }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  await prisma.user.update({ where: { email: rec.email }, data: { passwordHash } });
  await prisma.passwordResetToken.delete({ where: { token } });

  return NextResponse.json({ ok: true });
}
