import { NextRequest } from "next/server";

import {
  GUEST_REFRESH_HEADER,
  guardGuestRequest,
  statusForGuestFailure,
} from "@/lib/auth/guest-guard";
import {
  GUEST_COOKIE_MAX_AGE,
  GUEST_COOKIE_NAME,
} from "@/lib/auth/guest-session";
import { clientIp, rateLimitResponse } from "@/lib/http/client-ip";
import { log } from "@/lib/log/logger";
import { computePosition } from "@/lib/parties/position";
import type { PartyStatus } from "@pila/db/schema";
import {
  buildGuestSnapshot,
  isTerminalStatus,
  type GuestStreamEvent,
} from "@/lib/parties/stream-events";
import { RateLimitError, consume } from "@/lib/ratelimit";
import {
  channelForParty,
  channelForTenantQueue,
  subscribe,
} from "@/lib/redis/pubsub";
import { resolvedPartyShortCircuit, sseStream } from "@/lib/sse/stream";

export const dynamic = "force-dynamic";

function refreshedGuestCookie(value: string): string {
  return [
    `${GUEST_COOKIE_NAME}=${value}`,
    `Max-Age=${GUEST_COOKIE_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; partyId: string } },
) {
  const ip = clientIp(req.headers);
  try {
    await consume("guestStreamPerIp", ip);
  } catch (err) {
    if (err instanceof RateLimitError)
      return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  const guard = await guardGuestRequest(req, params.slug, params.partyId);
  if (!guard.ok) {
    const status = statusForGuestFailure(guard.reason, "stream");
    if (status === 204) return resolvedPartyShortCircuit();
    return new Response(null, { status });
  }
  const { tenant, party: activeParty, source, refreshedBearer } = guard;
  if (isTerminalStatus(activeParty.status as PartyStatus)) {
    return resolvedPartyShortCircuit();
  }

  const extraHeaders: Record<string, string> = {};
  if (source === "cookie") {
    extraHeaders["Set-Cookie"] = refreshedGuestCookie(activeParty.sessionToken);
  }
  if (refreshedBearer) {
    extraHeaders[GUEST_REFRESH_HEADER] = refreshedBearer;
  }

  let unsubscribe: (() => Promise<void>) | null = null;

  return sseStream({
    extraHeaders,
    onSubscribe: async (handle) => {
      unsubscribe = await subscribe(
        [channelForParty(activeParty.id), channelForTenantQueue(tenant.slug)],
        (event, channel) => {
          if (channel === channelForParty(activeParty.id)) {
            const ev = event as GuestStreamEvent;
            handle.send({ data: ev });
            if (ev.type === "status_changed" && isTerminalStatus(ev.status)) {
              handle.close();
            }
            return;
          }
          const tenantEvent = event as { type?: string };
          if (
            tenantEvent.type === "tenant:updated" ||
            tenantEvent.type === "tenant:opened" ||
            tenantEvent.type === "tenant:closed"
          ) {
            handle.send({ data: tenantEvent as GuestStreamEvent });
          }
        },
      );
    },
    snapshot: async () => {
      const position = await computePosition(tenant.id, activeParty.id);
      return {
        data: buildGuestSnapshot({
          status: activeParty.status as "waiting",
          position,
          name: activeParty.name,
          joinedAt: activeParty.joinedAt,
        }),
      };
    },
    onClose: async () => {
      try {
        await unsubscribe?.();
      } catch (err) {
        log.warn("guest.stream.unsubscribe_failed", {
          slug: params.slug,
          partyId: params.partyId,
          err: String(err),
        });
      }
    },
  });
}
