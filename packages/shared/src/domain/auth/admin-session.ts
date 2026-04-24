import NextAuth, { type DefaultSession } from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { env } from "../../primitives/config/env";
import { getDb } from "@pila/db/client";
import { accounts, sessions, users, verificationTokens } from "@pila/db/schema";
import { log } from "../../infra/log/logger";
import { sendMagicLink } from "../../infra/email/resend";
import { captureMagicLink } from "../../domain/auth/test-magic-link-store";
import { isAdminEmail } from "../../primitives/validators/admin-allow-list";

declare module "next-auth" {
  interface Session {
    user: { id: string; email: string } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  secret: env().NEXTAUTH_SECRET,
  session: { strategy: "database" },
  pages: {
    signIn: "/admin",
    verifyRequest: "/admin/check-email",
    error: "/admin",
  },
  providers: [
    Resend({
      apiKey: env().RESEND_API_KEY,
      from:
        process.env.ADMIN_MAGIC_LINK_FROM ??
        "Queue Admin <onboarding@resend.dev>",
      async sendVerificationRequest({ identifier, url }) {
        if (!isAdminEmail(identifier)) {
          log.warn("admin.magic_link.blocked", { email: identifier });
          return;
        }
        if (
          process.env.NODE_ENV === "test" ||
          process.env.ENABLE_TEST_ROUTES === "1"
        ) {
          // Capture the URL (with plaintext token) so E2E can fetch it via /api/test/magic-link.
          captureMagicLink(identifier, url);
          log.info("admin.magic_link.test_captured", { email: identifier });
          return;
        }
        const host = new URL(url).host;
        await sendMagicLink({ to: identifier, url, host });
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email ?? "";
      if (!isAdminEmail(email)) {
        log.warn("admin.sign_in.blocked", { email });
        return false;
      }
      return true;
    },
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});
