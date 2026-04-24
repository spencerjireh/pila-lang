import { NextRequest } from "next/server";

import { clientIp } from "@pila/shared/infra/http/client-ip";
import { log } from "@pila/shared/infra/log/logger";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
import {
  channelForTenantQueue,
  subscribe,
} from "@pila/shared/infra/redis/pubsub";
import { sseStream } from "@/lib/sse/stream";
import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const limited = await enforceRateLimit([
    { bucket: "displayRequestsPerIp", key: clientIp(req.headers) },
  ]);
  if (limited) return limited;

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
