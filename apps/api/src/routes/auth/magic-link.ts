import { Router } from "express";
import { z } from "zod";

import { issueMagicLink } from "@pila/shared/domain/auth/admin-magic-link";
import { captureMagicLink } from "@pila/shared/domain/auth/test-magic-link-store";
import { sendMagicLink } from "@pila/shared/infra/email/resend";
import { env } from "@pila/shared/primitives/config/env";
import { isAdminEmail } from "@pila/shared/primitives/validators/admin-allow-list";

import { enforceRateLimits } from "../../lib/rate-limit.js";
import { logger } from "../../lib/logger.js";

export const magicLinkRouter = Router();

const Body = z.object({
  email: z.string().email(),
});

magicLinkRouter.post("/auth/magic-link", async (req, res) => {
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "invalid_body",
      issues: parsed.error.flatten(),
    });
    return;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip = req.ip ?? "unknown";

  const limited = await enforceRateLimits(res, [
    { bucket: "adminMagicLinkPerIp", key: ip },
    { bucket: "adminMagicLinkPerEmail", key: email },
  ]);
  if (limited) return;

  // Always return the same success shape regardless of allow-list match,
  // so the endpoint doesn't double as an admin email enumerator.
  if (!isAdminEmail(email)) {
    logger.warn({ email }, "admin.magic_link.blocked");
    res.json({ ok: true });
    return;
  }

  const issued = await issueMagicLink({ email, baseUrl: env().APP_BASE_URL });

  const isTestMode =
    process.env.NODE_ENV === "test" || process.env.ENABLE_TEST_ROUTES === "1";

  if (isTestMode) {
    captureMagicLink(issued.identifier, issued.url);
    logger.info({ email }, "admin.magic_link.test_captured");
  } else {
    const host = new URL(issued.url).host;
    await sendMagicLink({ to: issued.identifier, url: issued.url, host });
    logger.info({ email }, "admin.magic_link.sent");
  }

  res.json({ ok: true });
});
