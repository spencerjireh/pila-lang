import { NextRequest } from "next/server";

import {
  applyHostRefresh,
  guardHostRequest,
  unauthorizedJson,
} from "@/lib/auth/host-guard";
import { swapLogo } from "@/lib/host/settings-actions";
import { log } from "@/lib/log/logger";
import {
  MAX_UPLOAD_BYTES,
  processLogoUpload,
} from "@/lib/storage/logo-pipeline";
import {
  deleteLogo,
  objectKeyFromUrl,
  publicUrlFor,
  putLogo,
} from "@/lib/storage/s3-client";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) {
    return unauthorizedJson(
      guard.status,
      guard.clearCookie,
      guardError(guard.status),
    );
  }

  const contentType = (req.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.startsWith("application/json")) {
    const body = await req.json().catch(() => null);
    if (!body || body.clear !== true) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }
    const swap = await swapLogo(guard.tenant.id, guard.tenant.slug, null);
    if (!swap) return Response.json({ error: "not_found" }, { status: 404 });
    await safeDelete(swap.oldLogoUrl);
    log.info("host.settings.logo.cleared", { slug: params.slug });
    return applyHostRefresh(
      Response.json({ logoUrl: null }, { status: 200 }),
      guard,
    );
  }

  if (!contentType.startsWith("multipart/form-data")) {
    return Response.json({ error: "bad_content_type" }, { status: 415 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid_form" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

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
    return Response.json({ error: errorFor(processed.reason) }, { status });
  }

  try {
    await putLogo(processed.key, processed.pngBuffer);
  } catch (err) {
    log.error("host.settings.logo.put_failed", {
      slug: params.slug,
      err: String(err),
    });
    return Response.json({ error: "storage_failed" }, { status: 502 });
  }

  const newUrl = publicUrlFor(processed.key);
  const swap = await swapLogo(guard.tenant.id, guard.tenant.slug, newUrl);
  if (!swap) {
    await safeDelete(newUrl);
    return Response.json({ error: "not_found" }, { status: 404 });
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

function guardError(status: 401 | 403 | 404): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "not_found";
}
