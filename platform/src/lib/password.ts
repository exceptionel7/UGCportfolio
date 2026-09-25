import bcrypt from "bcryptjs";

/**
 * Secure password hashing (Phase 1).
 * Uses bcrypt with a work factor of 12. Passwords are NEVER stored in plaintext
 * or base64 — only the bcrypt hash is persisted (User.passwordHash).
 */
const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string | null | undefined): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/** Minimum password policy — enforced server-side at registration/reset. */
export function isStrongEnough(pw: string): boolean {
  return typeof pw === "string" && pw.length >= 8;
}
