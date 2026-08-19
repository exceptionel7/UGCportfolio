import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe base config shared by middleware and the full server config.
 * Contains NO Node-only imports (no Prisma/bcrypt) so it can run in the
 * middleware runtime. Providers are added in `auth.ts`.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    // Put the trusted identity (id + role) into the signed JWT.
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id ?? token.sub;
        token.role = (user as { role?: string }).role ?? "CUSTOMER";
      }
      return token;
    },
    // Expose id + role on the session (server-verified — not client-supplied).
    session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
