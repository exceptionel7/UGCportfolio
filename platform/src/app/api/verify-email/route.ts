import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/verify-email?token=... — marks the user's email verified. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  if (!token) return NextResponse.redirect(`${base}/login?error=missing_token`);

  const rec = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!rec || rec.expires < new Date()) {
    return NextResponse.redirect(`${base}/login?error=invalid_or_expired`);
  }

  await prisma.user.update({ where: { email: rec.email }, data: { emailVerified: new Date() } });
  await prisma.emailVerificationToken.delete({ where: { token } });

  return NextResponse.redirect(`${base}/login?verified=1`);
}
