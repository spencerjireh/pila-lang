import { NextRequest } from "next/server";

import {
  GUEST_COOKIE_MAX_AGE,
  GUEST_COOKIE_NAME,
} from "@/lib/auth/guest-session";
import { clientIp, rateLimitResponse } from "@/lib/http/client-ip";
import { log } from "@/lib/log/logger";
import { findPartyById } from "@/lib/parties/lookup";
import { computePosition } from "@/lib/parties/position";
import { guestStreamAuth } from "@/lib/parties/stream-auth";
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
import { loadTenantBySlug } from "@/lib/tenants/display-token";

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
    if (err instanceof RateLimitError) return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  const lookup = await loadTenantBySlug(params.slug);
  if (!lookup.ok) return new Response(null, { status: 404 });
  const tenant = lookup.tenant;

  const cookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  const party = await findPartyById(tenant.id, params.partyId);

  const decision = guestStreamAuth({ tenant, party, cookie });
  if (!decision.ok) {
    if (decision.status === 204) return resolvedPartyShortCircuit();
    return new Response(null, { status: decision.status });
  }
  const activeParty = decision.party;

  let unsubscribe: (() => Promise<void>) | null = null;

  return sseStream({
    extraHeaders: {
      "Set-Cookie": refreshedGuestCookie(activeParty.sessionToken),
    },
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
