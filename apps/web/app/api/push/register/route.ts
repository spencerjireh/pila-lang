import { NextRequest } from "next/server";
import { z } from "zod";

import { clientIp } from "@pila/shared/infra/http/client-ip";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { log } from "@pila/shared/infra/log/logger";
import { authorizePushBearer } from "@pila/shared/domain/push/auth";
import { registerPushToken } from "@pila/shared/domain/push/registry";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  platform: z.enum(["ios", "android"]),
  deviceToken: z.string().min(8).max(4096),
});

export async function POST(req: NextRequest) {
  const limited = await enforceRateLimit([
    { bucket: "pushRegisterPerIp", key: clientIp(req.headers) },
  ]);
  if (limited) return limited;

  const auth = await authorizePushBearer(req.headers);
  if (!auth) return errorResponse(401, "unauthorized");

  const parsed = await parseJsonBody(req, bodySchema);
  if (!parsed.ok) return parsed.response;

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
