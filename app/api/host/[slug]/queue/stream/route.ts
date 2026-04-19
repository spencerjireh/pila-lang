import { NextRequest } from "next/server";

import { guardHostRequest, unauthorizedJson } from "@/lib/auth/host-guard";
import { clientIp, rateLimitResponse } from "@/lib/http/client-ip";
import { log } from "@/lib/log/logger";
import {
  buildHostSnapshot,
  loadRecentlyResolved,
  loadWaiting,
  type HostStreamDiff,
} from "@/lib/parties/host-stream";
import { RateLimitError, consume } from "@/lib/ratelimit";
import { channelForTenantQueue, subscribe } from "@/lib/redis/pubsub";
import { sseStream } from "@/lib/sse/stream";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const ip = clientIp(req.headers);
  try {
    await consume("hostStreamPerIpSlug", `${ip}:${params.slug}`);
  } catch (err) {
    if (err instanceof RateLimitError)
      return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) {
    return unauthorizedJson(
      guard.status,
      guard.clearCookie,
      guardErrorFor(guard.status),
    );
  }
  const { tenant } = guard;

  let unsubscribe: (() => Promise<void>) | null = null;

  const extraHeaders: Record<string, string> = {};
  if (guard.refreshedCookie) extraHeaders["Set-Cookie"] = guard.refreshedCookie;

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

function guardErrorFor(status: 401 | 403 | 404): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "not_found";
}
