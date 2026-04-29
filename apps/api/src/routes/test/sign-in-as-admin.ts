import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@pila/db/client";
import { users } from "@pila/db/schema";
import {
  issueAdminSession,
  serializeAdminCookie,
} from "@pila/shared/domain/auth/admin-jwt-cookie";
import { isAdminEmail } from "@pila/shared/primitives/validators/admin-allow-list";

import { asyncHandler } from "../../lib/async-handler.js";

export const testSignInAsAdminRouter = Router();

const Body = z.object({ email: z.string().email() });

/**
 * Mints the new admin JWT cookie (NOT the legacy NextAuth session cookie)
 * so e2e specs that drive the admin UI work against the post-cutover auth.
 */
testSignInAsAdminRouter.post(
  "/test/sign-in-as-admin",
  asyncHandler(async (req, res) => {
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_body", issues: parsed.error.flatten() });
      return;
    }
    const email = parsed.data.email.trim().toLowerCase();
    if (!isAdminEmail(email)) {
      res.status(403).json({ error: "not_allow_listed" });
      return;
    }

    const db = getDb();
    let [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) {
      [user] = await db
        .insert(users)
        .values({ email, emailVerified: new Date() })
        .returning({ id: users.id });
    }

    const token = await issueAdminSession(user!.id, email);
    res.setHeader("Set-Cookie", serializeAdminCookie(token));
    res.json({ ok: true, userId: user!.id });
  }),
);
