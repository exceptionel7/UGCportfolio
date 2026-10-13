import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** GET /api/verify-email?token=... — marks the user's email verified. */
export async function GET(req: Request) {
  const reqUrl = new URL(req.url);
  const token = reqUrl.searchParams.get("token");
  // Always redirect to an absolute URL (env preferred, else the request origin).
  const base = process.env.NEXT_PUBLIC_APP_URL || reqUrl.origin;
  if (!token) return NextResponse.redirect(`${base}/login?error=missing_token`);

  const rec = await prisma.emailVerificationToken.findUnique({ where: { token } });
  if (!rec || rec.expires < new Date()) {
    return NextResponse.redirect(`${base}/login?error=invalid_or_expired`);
  }

  await prisma.user.update({ where: { email: rec.email }, data: { emailVerified: new Date() } });
  await prisma.emailVerificationToken.delete({ where: { token } });

  return NextResponse.redirect(`${base}/login?verified=1`);
}
