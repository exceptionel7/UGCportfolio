import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Edge-safe auth (reads the signed session cookie; no DB access here).
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isAuthed = !!req.auth;
  const role = (req.auth?.user as { role?: string } | undefined)?.role;

  const needsAuth =
    path.startsWith("/dashboard") ||
    path.startsWith("/admin") ||
    path.startsWith("/api/admin");

  if (needsAuth && !isAuthed) {
    const url = new URL("/login", nextUrl);
    url.searchParams.set("callbackUrl", path);
    return Response.redirect(url);
  }

  // Admin surfaces require the ADMIN role — verified from the signed session,
  // NOT from anything the client can set.
  if ((path.startsWith("/admin") || path.startsWith("/api/admin")) && role !== "ADMIN") {
    return Response.redirect(new URL("/dashboard?forbidden=1", nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/admin/:path*"],
};
