import { NextRequest } from "next/server";
import { z } from "zod";

import { guardHostRequest, unauthorizedJson } from "@/lib/auth/host-guard";
import { updateTenantBranding } from "@/lib/host/settings-actions";
import { log } from "@/lib/log/logger";
import { validateAccentColor } from "@/lib/validators/contrast";

export const dynamic = "force-dynamic";

const generalSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    accentColor: z.string().trim().optional(),
  })
  .strict();

export async function PATCH(
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

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "bad_content_type" }, { status: 415 });
  }

  const body = await req.json().catch(() => null);
  const parsed = generalSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const patch = parsed.data;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "no_fields" }, { status: 400 });
  }

  if (patch.accentColor !== undefined) {
    const check = validateAccentColor(patch.accentColor);
    if (!check.ok) {
      return Response.json(
        { error: "invalid_accent_color", reason: check.reason },
        { status: 422 },
      );
    }
  }

  const row = await updateTenantBranding(
    guard.tenant.id,
    guard.tenant.slug,
    patch,
  );
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });

  log.info("host.settings.general.updated", {
    slug: params.slug,
    fields: Object.keys(patch),
  });
  return withRefresh(
    Response.json({ tenant: row }, { status: 200 }),
    guard.refreshedCookie,
  );
}

function guardError(status: 401 | 403 | 404): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "not_found";
}

function withRefresh(res: Response, cookie: string | null): Response {
  if (!cookie) return res;
  res.headers.append("Set-Cookie", cookie);
  return res;
}
