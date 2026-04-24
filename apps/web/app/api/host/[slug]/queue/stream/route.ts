import { NextRequest } from "next/server";

import {
  guardHostRequest,
  HOST_REFRESH_HEADER,
  hostGuardErrorResponse,
} from "@pila/shared/domain/auth/host-guard";
import { clientIp } from "@pila/shared/infra/http/client-ip";
import { log } from "@pila/shared/infra/log/logger";
import {
  buildHostSnapshot,
  loadRecentlyResolved,
  loadWaiting,
  type HostStreamDiff,
} from "@pila/shared/domain/parties/host-stream";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
import {
  channelForTenantQueue,
  subscribe,
} from "@pila/shared/infra/redis/pubsub";
import { sseStream } from "@/lib/sse/stream";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const limited = await enforceRateLimit([
    {
      bucket: "hostStreamPerIpSlug",
      key: `${clientIp(req.headers)}:${params.slug}`,
    },
  ]);
  if (limited) return limited;

  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) return hostGuardErrorResponse(guard);
  const { tenant } = guard;

  let unsubscribe: (() => Promise<void>) | null = null;

  const extraHeaders: Record<string, string> = {};
  if (guard.refreshedCookie) extraHeaders["Set-Cookie"] = guard.refreshedCookie;
  if (guard.refreshedBearer)
    extraHeaders[HOST_REFRESH_HEADER] = guard.refreshedBearer;

  return sseStream({
    extraHeaders,
    onSubscribe: async (handle) => {
      unsubscribe = await subscribe(
        [channelForTenantQueue(tenant.slug)],
        (event) => {
          handle.send({ data: event as HostStreamDiff });
        },
      );
    },
    snapshot: async () => {
      const [waiting, recentlyResolved] = await Promise.all([
        loadWaiting(tenant.id),
        loadRecentlyResolved(tenant.id),
      ]);
      return {
        data: buildHostSnapshot(tenant, waiting, recentlyResolved),
      };
    },
    onClose: async () => {
      try {
        await unsubscribe?.();
      } catch (err) {
        log.warn("host.stream.unsubscribe_failed", {
          slug: params.slug,
          err: String(err),
        });
      }
    },
  });
}
