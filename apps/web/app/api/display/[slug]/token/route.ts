import { NextRequest } from "next/server";

import { clientIp } from "@pila/shared/infra/http/client-ip";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { log } from "@pila/shared/infra/log/logger";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
import { resolveDisplayToken } from "@pila/shared/domain/tenants/display-token";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const limited = await enforceRateLimit([
    { bucket: "displayRequestsPerIp", key: clientIp(req.headers) },
  ]);
  if (limited) return limited;

  try {
    const result = await resolveDisplayToken(params.slug);
    if (!result.ok) return errorResponse(404, "not_found");
    return Response.json(result.payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    log.error("display.token.failed", { slug: params.slug, err: String(err) });
    return errorResponse(500, "internal");
  }
}
