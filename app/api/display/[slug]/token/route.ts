import { NextRequest } from "next/server";

import { clientIp, rateLimitResponse } from "@pila/shared/http/client-ip";
import { log } from "@pila/shared/log/logger";
import { RateLimitError, consume } from "@pila/shared/ratelimit";
import { resolveDisplayToken } from "@pila/shared/tenants/display-token";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const ip = clientIp(req.headers);
  try {
    await consume("displayRequestsPerIp", ip);
  } catch (err) {
    if (err instanceof RateLimitError)
      return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  try {
    const result = await resolveDisplayToken(params.slug);
    if (!result.ok)
      return Response.json({ error: "not_found" }, { status: 404 });
    return Response.json(result.payload, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    log.error("display.token.failed", { slug: params.slug, err: String(err) });
    return Response.json({ error: "internal" }, { status: 500 });
  }
}
