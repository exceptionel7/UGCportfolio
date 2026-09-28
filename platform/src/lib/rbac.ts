import "server-only";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/lib/auth";

/**
 * Server-side authorization helpers (Phase 1).
 *
 * These run ONLY on the server. Role/identity always comes from the encrypted
 * session (Auth.js JWT), never from the client. A user cannot elevate to ADMIN
 * by editing localStorage or client JavaScript because permission checks happen
 * here, on the server, against the signed session.
 */

export type SessionUser = {
  id: string;
  role: Role;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as unknown as SessionUser;
}

/** Require any authenticated user; redirect to login otherwise. */
export async function requireUser(callbackUrl = "/dashboard"): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  return user;
}

/** Require one of the given roles; redirect (or 404-style) otherwise. */
export async function requireRole(roles: Role | Role[], callbackUrl = "/dashboard"): Promise<SessionUser> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await requireUser(callbackUrl);
  if (!allowed.includes(user.role)) redirect("/dashboard?forbidden=1");
  return user;
}

/** Boolean check for use inside API route handlers. */
export async function hasRole(roles: Role | Role[]): Promise<boolean> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await getSessionUser();
  return !!user && allowed.includes(user.role);
}
