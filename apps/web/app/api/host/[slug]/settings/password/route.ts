import { NextRequest, NextResponse } from "next/server";

import {
  guardHostRequest,
  HOST_REFRESH_HEADER,
  hostGuardErrorResponse,
} from "@pila/shared/domain/auth/host-guard";
import {
  hostCookieAttrs,
  HOST_COOKIE_NAME,
} from "@pila/shared/domain/auth/host-session";
import { signHostToken } from "@pila/shared/domain/auth/host-token";
import { hashPassword } from "@pila/shared/domain/auth/password";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { rotateHostPassword } from "@pila/shared/domain/host/settings-actions";
import { log } from "@pila/shared/infra/log/logger";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
import { passwordChangeSchema } from "@pila/shared/primitives/validators/password";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) return hostGuardErrorResponse(guard);

  const limited = await enforceRateLimit([
    { bucket: "hostPasswordRotatePerSlug", key: params.slug },
  ]);
  if (limited) return limited;

  const parsed = await parseJsonBody(req, passwordChangeSchema);
  if (!parsed.ok) return parsed.response;

  let newHash: string | undefined;
  if (parsed.data.action === "rotate") {
    newHash = await hashPassword(parsed.data.newPassword);
  }

  const result = await rotateHostPassword(guard.tenant.id, { newHash });
  if (!result) return errorResponse(404, "not_found");

  const token = await signHostToken({
    slug: guard.tenant.slug,
    pwv: result.newVersion,
    jti: guard.claims.jti,
  });

  const res = NextResponse.json(
    { ok: true, version: result.newVersion },
    { status: 200 },
  );
  if (guard.source === "cookie") {
    res.cookies.set({
      name: HOST_COOKIE_NAME,
      value: token,
      ...hostCookieAttrs(),
    });
  } else {
    res.headers.set(HOST_REFRESH_HEADER, token);
  }

  log.info("host.settings.password.rotated", {
    slug: params.slug,
    action: parsed.data.action,
    newVersion: result.newVersion,
  });
  return res;
}
