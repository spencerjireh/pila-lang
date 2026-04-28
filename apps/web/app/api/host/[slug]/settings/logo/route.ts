import { NextRequest } from "next/server";
import { z } from "zod";

import {
  applyHostRefresh,
  guardHostRequest,
  hostGuardErrorResponse,
} from "@pila/shared/domain/auth/host-guard";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { swapLogo } from "@pila/shared/domain/host/settings-actions";
import { log } from "@pila/shared/infra/log/logger";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
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

export const dynamic = "force-dynamic";

const clearLogoSchema = z.object({ clear: z.literal(true) }).strict();

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const limited = await enforceRateLimit([
    { bucket: "hostMutationPerSlug", key: params.slug },
  ]);
  if (limited) return limited;

  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) return hostGuardErrorResponse(guard);

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.startsWith("application/json")) {
    const parsed = await parseJsonBody(req, clearLogoSchema);
    if (!parsed.ok) return parsed.response;
    const swap = await swapLogo(guard.tenant.id, guard.tenant.slug, null);
    if (!swap) return errorResponse(404, "not_found");
    await safeDelete(swap.oldLogoUrl);
    log.info("host.settings.logo.cleared", { slug: params.slug });
    return applyHostRefresh(
      Response.json({ logoUrl: null }, { status: 200 }),
      guard,
    );
  }

  if (!contentType.startsWith("multipart/form-data")) {
    return errorResponse(415, "bad_content_type");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse(400, "invalid_form");
  }

  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse(400, "missing_file");
  if (file.size > MAX_UPLOAD_BYTES) return errorResponse(413, "too_large");

  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const processed = await processLogoUpload(buffer, file.type, guard.tenant.id);
  if (!processed.ok) {
    const status =
      processed.reason === "size"
        ? 413
        : processed.reason === "mime"
          ? 415
          : 400;
    return errorResponse(status, errorFor(processed.reason));
  }

  try {
    await putLogo(processed.key, processed.pngBuffer);
  } catch (err) {
    log.error("host.settings.logo.put_failed", {
      slug: params.slug,
      err: String(err),
    });
    return errorResponse(502, "storage_failed");
  }

  const newUrl = publicUrlFor(processed.key);
  const swap = await swapLogo(guard.tenant.id, guard.tenant.slug, newUrl);
  if (!swap) {
    await safeDelete(newUrl);
    return errorResponse(404, "not_found");
  }

  await safeDelete(swap.oldLogoUrl);
  log.info("host.settings.logo.updated", { slug: params.slug });
  return applyHostRefresh(
    Response.json({ logoUrl: newUrl }, { status: 200 }),
    guard,
  );
}

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
    log.warn("host.settings.logo.delete_failed", {
      key,
      err: String(err),
    });
  }
}
