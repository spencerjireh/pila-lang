import { NextRequest, NextResponse } from "next/server";

import {
  guardHostRequest,
  HOST_REFRESH_HEADER,
  unauthorizedJson,
} from "@/lib/auth/host-guard";
import { hostCookieAttrs, HOST_COOKIE_NAME } from "@/lib/auth/host-session";
import { signHostToken } from "@/lib/auth/host-token";
import { hashPassword } from "@/lib/auth/password";
import { rotateHostPassword } from "@/lib/host/settings-actions";
import { log } from "@/lib/log/logger";
import { passwordChangeSchema } from "@/lib/validators/password";

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

function guardError(status: 401 | 403 | 404): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "not_found";
}
