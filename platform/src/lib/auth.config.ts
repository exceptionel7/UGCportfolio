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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).id = (user as any).id ?? token.sub;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (token as any).role = (user as any).role ?? "CUSTOMER";
      }
      return token;
    },
    // Expose id + role on the session (server-verified — not client-supplied).
    session({ session, token }) {
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = (token as any).id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).role = (token as any).role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
