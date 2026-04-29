import { Router } from "express";
import { z } from "zod";

import { updateTenantBranding } from "@pila/shared/domain/host/settings-actions";
import { validateAccentColor } from "@pila/shared/primitives/validators/contrast";

import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireHost } from "../../middleware/require-host.js";

export const hostSettingsGeneralRouter = Router();

const Body = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    accentColor: z.string().trim().optional(),
  })
  .strict();

hostSettingsGeneralRouter.patch(
  "/host/:slug/settings/general",
  requireHost,
  async (req, res) => {
    const guard = req.hostGuard!;
    const slug = guard.tenant.slug;

    const limited = await enforceRateLimits(res, [
      { bucket: "hostMutationPerSlug", key: slug },
    ]);
    if (limited) return;

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: "invalid_body", issues: parsed.error.flatten() });
      return;
    }
    const patch = parsed.data;

    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "no_fields" });
      return;
    }

    if (patch.accentColor !== undefined) {
      const check = validateAccentColor(patch.accentColor);
      if (!check.ok) {
        res
          .status(422)
          .json({ error: "invalid_accent_color", reason: check.reason });
        return;
      }
    }

    const row = await updateTenantBranding(guard.tenant.id, slug, patch);
    if (!row) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    req.log.info(
      {
        slug,
        fields: Object.keys(patch),
      },
      "host.settings.general.updated",
    );
    res.json({ tenant: row });
  },
);
