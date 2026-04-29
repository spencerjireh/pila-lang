import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { swapLogo } from "@pila/shared/domain/host/settings-actions";
import { log } from "@pila/shared/infra/log/logger";
import {
  MAX_UPLOAD_BYTES,
  processLogoUpload,
} from "@pila/shared/infra/storage/logo-pipeline";
import {
  deleteLogo,
  objectKeyFromUrl,
  publicUrlFor,
  putLogo,
} from "@pila/shared/infra/storage/s3-client";

import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireHost } from "../../middleware/require-host.js";

export const hostSettingsLogoRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const ClearBody = z.object({ clear: z.literal(true) }).strict();

hostSettingsLogoRouter.post(
  "/host/:slug/settings/logo",
  requireHost,
  async (req, res, next) => {
    const guard = req.hostGuard!;
    const slug = guard.tenant.slug;

    const limited = await enforceRateLimits(res, [
      { bucket: "hostMutationPerSlug", key: slug },
    ]);
    if (limited) return;

    const contentType = (req.headers["content-type"] ?? "").toLowerCase();

    if (contentType.startsWith("application/json")) {
      const parsed = ClearBody.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ error: "invalid_body", issues: parsed.error.flatten() });
        return;
      }
      const swap = await swapLogo(guard.tenant.id, slug, null);
      if (!swap) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      await safeDelete(swap.oldLogoUrl);
      req.log.info({ slug }, "host.settings.logo.cleared");
      res.json({ logoUrl: null });
      return;
    }

    if (!contentType.startsWith("multipart/form-data")) {
      res.status(415).json({ error: "bad_content_type" });
      return;
    }

    // Defer to multer for the file. multer.single emits to req.file.
    upload.single("file")(req, res, async (err) => {
      if (err) {
        if ((err as { code?: string }).code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "too_large" });
          return;
        }
        next(err);
        return;
      }

      const file = req.file;
      if (!file) {
        res.status(400).json({ error: "missing_file" });
        return;
      }

      const processed = await processLogoUpload(
        file.buffer,
        file.mimetype,
        guard.tenant.id,
      );
      if (!processed.ok) {
        const status =
          processed.reason === "size"
            ? 413
            : processed.reason === "mime"
              ? 415
              : 400;
        res.status(status).json({ error: errorFor(processed.reason) });
        return;
      }

      try {
        await putLogo(processed.key, processed.pngBuffer);
      } catch (e) {
        req.log.error(
          {
            slug,
            err: String(e),
          },
          "host.settings.logo.put_failed",
        );
        res.status(502).json({ error: "storage_failed" });
        return;
      }

      const newUrl = publicUrlFor(processed.key);
      const swap = await swapLogo(guard.tenant.id, slug, newUrl);
      if (!swap) {
        await safeDelete(newUrl);
        res.status(404).json({ error: "not_found" });
        return;
      }

      await safeDelete(swap.oldLogoUrl);
      req.log.info({ slug }, "host.settings.logo.updated");
      res.json({ logoUrl: newUrl });
    });
  },
);

function errorFor(reason: "mime" | "size" | "decode" | "dims"): string {
  if (reason === "mime") return "invalid_mime";
  if (reason === "size") return "too_large";
  if (reason === "dims") return "bad_dimensions";
  return "decode_failed";
}

async function safeDelete(urlOrKey: string | null): Promise<void> {
  if (!urlOrKey) return;
  const key = urlOrKey.startsWith("http")
    ? objectKeyFromUrl(urlOrKey)
    : urlOrKey;
  if (!key) return;
  try {
    await deleteLogo(key);
  } catch (err) {
    log.warn("host.settings.logo.delete_failed", { key, err: String(err) });
  }
}
