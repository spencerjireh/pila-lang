import { Router } from "express";
import { z } from "zod";

import {
  issueAdminSession,
  serializeAdminCookie,
} from "@pila/shared/domain/auth/admin-jwt-cookie";
import { consumeMagicLink } from "@pila/shared/domain/auth/admin-magic-link";
import { env } from "@pila/shared/primitives/config/env";
import { isAdminEmail } from "@pila/shared/primitives/validators/admin-allow-list";

import { logger } from "../../lib/logger.js";

export const callbackRouter = Router();

const Query = z.object({
  token: z.string().min(1),
  email: z.string().email(),
});

callbackRouter.get("/auth/callback", async (req, res) => {
  const parsed = Query.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_query",
      issues: parsed.error.flatten(),
    });
    return;
  }

  if (!isAdminEmail(parsed.data.email)) {
    logger.warn(
      { email: parsed.data.email },
      "admin.callback.blocked_not_admin",
    );
    res.status(403).json({ error: "forbidden" });
    return;
  }

  const result = await consumeMagicLink({
    email: parsed.data.email,
    token: parsed.data.token,
  });

  if (!result.ok) {
    const status = result.reason === "expired" ? 410 : 401;
    res.status(status).json({ error: result.reason });
    return;
  }

  const token = await issueAdminSession(result.userId, result.email);
  res.setHeader("Set-Cookie", serializeAdminCookie(token));
  res.redirect(302, new URL("/admin", env().APP_BASE_URL).toString());
});
