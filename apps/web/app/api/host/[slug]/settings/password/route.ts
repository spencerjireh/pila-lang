import { NextRequest, NextResponse } from "next/server";

import {
  guardHostRequest,
  HOST_REFRESH_HEADER,
  hostGuardErrorResponse,
} from "@pila/shared/auth/host-guard";
import {
  hostCookieAttrs,
  HOST_COOKIE_NAME,
} from "@pila/shared/auth/host-session";
import { signHostToken } from "@pila/shared/auth/host-token";
import { hashPassword } from "@pila/shared/auth/password";
import { rotateHostPassword } from "@pila/shared/host/settings-actions";
import { log } from "@pila/shared/log/logger";
import { passwordChangeSchema } from "@pila/shared/validators/password";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) return hostGuardErrorResponse(guard);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "bad_content_type" }, { status: 415 });
  }

  const body = await req.json().catch(() => null);
  const parsed = passwordChangeSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let newHash: string | undefined;
  if (parsed.data.action === "rotate") {
    newHash = await hashPassword(parsed.data.newPassword);
  }

  const result = await rotateHostPassword(guard.tenant.id, { newHash });
  if (!result) return Response.json({ error: "not_found" }, { status: 404 });

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
