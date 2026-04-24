import { NextRequest } from "next/server";
import { z } from "zod";

import {
  applyHostRefresh,
  guardHostRequest,
  hostGuardErrorResponse,
} from "@pila/shared/domain/auth/host-guard";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { updateTenantBranding } from "@pila/shared/domain/host/settings-actions";
import { log } from "@pila/shared/infra/log/logger";
import { validateAccentColor } from "@pila/shared/primitives/validators/contrast";

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
  if (!guard.ok) return hostGuardErrorResponse(guard);

  const parsed = await parseJsonBody(req, generalSchema);
  if (!parsed.ok) return parsed.response;
  const patch = parsed.data;

  if (Object.keys(patch).length === 0) return errorResponse(400, "no_fields");

  if (patch.accentColor !== undefined) {
    const check = validateAccentColor(patch.accentColor);
    if (!check.ok) {
      return errorResponse(422, "invalid_accent_color", {
        reason: check.reason,
      });
    }
  }

  const row = await updateTenantBranding(
    guard.tenant.id,
    guard.tenant.slug,
    patch,
  );
  if (!row) return errorResponse(404, "not_found");

  log.info("host.settings.general.updated", {
    slug: params.slug,
    fields: Object.keys(patch),
  });
  return applyHostRefresh(
    Response.json({ tenant: row }, { status: 200 }),
    guard,
  );
}
