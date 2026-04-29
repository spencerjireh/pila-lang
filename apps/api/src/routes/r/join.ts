import { Router } from "express";
import { z } from "zod";

import {
  GUEST_COOKIE_MAX_AGE,
  GUEST_COOKIE_NAME,
  serializeGuestCookie,
} from "@pila/shared/domain/auth/guest-session";
import { joinQueue } from "@pila/shared/domain/parties/join";
import { log } from "@pila/shared/infra/log/logger";
import { verifyQrToken } from "@pila/shared/primitives/qr/token";

import { asyncHandler } from "../../lib/async-handler.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const rJoinRouter = Router();

const WELCOME_BACK_COOKIE = "welcome_back";
const WELCOME_BACK_MAX_AGE = 5 * 60;

const Body = z.object({
  name: z.string().trim().min(1, "name_required").max(80),
  partySize: z.number().int().min(1).max(20),
  phone: z
    .union([
      z
        .string()
        .trim()
        .regex(/^\+[1-9]\d{5,14}$/u, "bad_phone"),
      z.literal(""),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v && v !== "" ? v : null)),
});

rJoinRouter.post(
  "/r/:slug/join",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug ?? "");
    if (!slug) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const token = typeof req.query.t === "string" ? req.query.t : null;
    if (!token) {
      res.status(401).json({ error: "missing_token" });
      return;
    }
    const verdict = verifyQrToken(slug, token);
    if (!verdict.ok) {
      res.status(401).json({ error: "invalid_token", reason: verdict.reason });
      return;
    }

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_body", issues: parsed.error.flatten() });
      return;
    }
    const input = parsed.data;

    const limited = await enforceRateLimits(res, [
      input.phone
        ? { bucket: "joinPerPhone", key: input.phone }
        : { bucket: "joinPerIp", key: req.ip ?? "unknown" },
      { bucket: "joinGlobalPerTenant", key: slug },
    ]);
    if (limited) return;

    let result;
    try {
      result = await joinQueue(slug, {
        name: input.name,
        partySize: input.partySize,
        phone: input.phone,
      });
    } catch (err) {
      log.error("join.failed", { slug, err: String(err) });
      res.status(500).json({ error: "internal" });
      return;
    }

    if (!result.ok) {
      const status = result.reason === "not_found" ? 404 : 409;
      res.status(status).json({ error: result.reason });
      return;
    }

    log.info("party.joined", {
      slug,
      partyId: result.party.id,
      phoneSeenBefore: result.phoneSeenBefore,
    });

    const cookies: string[] = [
      serializeGuestCookie(result.party.sessionToken, GUEST_COOKIE_MAX_AGE),
    ];
    if (result.phoneSeenBefore) {
      cookies.push(
        `${WELCOME_BACK_COOKIE}=1; Max-Age=${WELCOME_BACK_MAX_AGE}; Path=/; Secure; SameSite=Lax`,
      );
    }
    res.setHeader("Set-Cookie", cookies);
    res.status(201).json({
      partyId: result.party.id,
      waitUrl: result.waitUrl,
    });

    void GUEST_COOKIE_NAME;
  }),
);
