import { NextRequest } from "next/server";
import { z } from "zod";

import { clientIp, rateLimitResponse } from "@pila/shared/http/client-ip";
import { log } from "@pila/shared/log/logger";
import { authorizePushBearer } from "@pila/shared/push/auth";
import { registerPushToken } from "@pila/shared/push/registry";
import { RateLimitError, consume } from "@pila/shared/ratelimit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  platform: z.enum(["ios", "android"]),
  deviceToken: z.string().min(8).max(4096),
});

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "bad_content_type" }, { status: 415 });
  }

  const ip = clientIp(req.headers);
  try {
    await consume("pushRegisterPerIp", ip);
  } catch (err) {
    if (err instanceof RateLimitError)
      return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  const auth = await authorizePushBearer(req.headers);
  if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "invalid_body" }, { status: 400 });

  const row = await registerPushToken({
    tenantId: auth.tenantId,
    scope: auth.kind,
    scopeId: auth.scopeId,
    platform: parsed.data.platform,
    deviceToken: parsed.data.deviceToken,
  });

  log.info("push.token.registered", {
    slug: auth.slug,
    scope: auth.kind,
    platform: parsed.data.platform,
  });
  return Response.json({ id: row.id }, { status: 200 });
}
