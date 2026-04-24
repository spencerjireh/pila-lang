import { NextRequest } from "next/server";

import {
  GUEST_REFRESH_HEADER,
  guardGuestRequest,
  statusForGuestFailure,
} from "@pila/shared/domain/auth/guest-guard";
import { serializeGuestCookie } from "@pila/shared/domain/auth/guest-session";
import { clientIp } from "@pila/shared/infra/http/client-ip";
import { log } from "@pila/shared/infra/log/logger";
import { computePosition } from "@pila/shared/domain/parties/position";
import type { PartyStatus } from "@pila/db/schema";
import {
  buildGuestSnapshot,
  isTerminalStatus,
  type GuestStreamEvent,
} from "@pila/shared/domain/parties/stream-events";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";
import {
  channelForParty,
  channelForTenantQueue,
  subscribe,
} from "@pila/shared/infra/redis/pubsub";
import { resolvedPartyShortCircuit, sseStream } from "@/lib/sse/stream";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string; partyId: string } },
) {
  const limited = await enforceRateLimit([
    { bucket: "guestStreamPerIp", key: clientIp(req.headers) },
  ]);
  if (limited) return limited;

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
    extraHeaders["Set-Cookie"] = serializeGuestCookie(activeParty.sessionToken);
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
