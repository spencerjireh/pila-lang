import { NextRequest } from "next/server";

import { clientIp, rateLimitResponse } from "@/lib/http/client-ip";
import { log } from "@/lib/log/logger";
import { RateLimitError, consume } from "@/lib/ratelimit";
import { channelForTenantQueue, subscribe } from "@/lib/redis/pubsub";
import { sseStream } from "@/lib/sse/stream";
import { loadTenantBySlug } from "@/lib/tenants/display-token";

export const dynamic = "force-dynamic";

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

  const lookup = await loadTenantBySlug(params.slug);
  if (!lookup.ok) return new Response(null, { status: 404 });
  const tenant = lookup.tenant;

  let unsubscribe: (() => Promise<void>) | null = null;

  return sseStream({
    onSubscribe: async (handle) => {
      unsubscribe = await subscribe(
        [channelForTenantQueue(tenant.slug)],
        (event) => {
          const ev = event as { type?: string };
          if (
            ev.type === "tenant:updated" ||
            ev.type === "tenant:opened" ||
            ev.type === "tenant:closed"
          ) {
            handle.send({ data: ev });
          }
        },
      );
    },
    snapshot: () => ({
      data: {
        type: "ready" as const,
        tenant: {
          name: tenant.name,
          logoUrl: tenant.logoUrl,
          accentColor: tenant.accentColor,
          isOpen: tenant.isOpen,
        },
      },
    }),
    onClose: async () => {
      try {
        await unsubscribe?.();
      } catch (err) {
        log.warn("display.stream.unsubscribe_failed", {
          slug: params.slug,
          err: String(err),
        });
      }
    },
  });
}
