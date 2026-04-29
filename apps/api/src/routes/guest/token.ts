import { Router } from "express";
import { z } from "zod";

import { GUEST_COOKIE_NAME } from "@pila/shared/domain/auth/guest-session";
import {
  GUEST_TOKEN_TTL_SECONDS,
  signGuestToken,
} from "@pila/shared/domain/auth/guest-token";
import { findPartyById } from "@pila/shared/domain/parties/lookup";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";
import { log } from "@pila/shared/infra/log/logger";

import { asyncHandler } from "../../lib/async-handler.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";

export const guestTokenRouter = Router();

const Body = z.object({
  slug: z.string().min(1).max(64),
  partyId: z.string().uuid(),
});

guestTokenRouter.post(
  "/guest/token",
  asyncHandler(async (req, res) => {
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    const cookie = cookies[GUEST_COOKIE_NAME];
    if (!cookie) {
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_body", issues: parsed.error.flatten() });
      return;
    }

    const limited = await enforceRateLimits(res, [
      { bucket: "guestTokenPerIp", key: req.ip ?? "unknown" },
    ]);
    if (limited) return;

    const lookup = await loadTenantBySlug(parsed.data.slug);
    if (!lookup.ok) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const tenant = lookup.tenant;

    const party = await findPartyById(tenant.id, parsed.data.partyId);
    if (!party) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    if (party.sessionToken !== cookie) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    const token = await signGuestToken({
      slug: tenant.slug,
      partyId: party.id,
    });

    log.info("guest.token.issued", { slug: tenant.slug, partyId: party.id });
    res.json({
      token,
      tokenType: "Bearer",
      expiresIn: GUEST_TOKEN_TTL_SECONDS,
      slug: tenant.slug,
      partyId: party.id,
    });
  }),
);
