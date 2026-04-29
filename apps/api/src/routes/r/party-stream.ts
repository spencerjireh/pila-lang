import { Router } from "express";

import type { PartyStatus } from "@pila/db/schema";
import {
  GUEST_REFRESH_HEADER,
  guardGuestRequest,
  statusForGuestFailure,
} from "@pila/shared/domain/auth/guest-guard";
import { serializeGuestCookie } from "@pila/shared/domain/auth/guest-session";
import { computePosition } from "@pila/shared/domain/parties/position";
import {
  buildGuestSnapshot,
  isTerminalStatus,
  type GuestStreamEvent,
} from "@pila/shared/domain/parties/stream-events";
import { log } from "@pila/shared/infra/log/logger";
import {
  channelForParty,
  channelForTenantQueue,
  subscribe,
} from "@pila/shared/infra/redis/pubsub";
import {
  resolvedPartyShortCircuit,
  startSseStream,
} from "@pila/shared/infra/sse/stream";

import { asyncHandler } from "../../lib/async-handler.js";
import { expressToRequestLike } from "../../lib/express-request-like.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";
import { register, unregister } from "../../lib/sse-registry.js";

export const partyStreamRouter = Router();

partyStreamRouter.get(
  "/r/:slug/parties/:partyId/stream",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug ?? "");
    const partyId = String(req.params.partyId ?? "");
    if (!slug || !partyId) {
      res.status(404).end();
      return;
    }

    const limited = await enforceRateLimits(res, [
      { bucket: "guestStreamPerIp", key: req.ip ?? "unknown" },
    ]);
    if (limited) return;

    const guard = await guardGuestRequest(
      expressToRequestLike(req),
      slug,
      partyId,
    );
    if (!guard.ok) {
      const status = statusForGuestFailure(guard.reason, "stream");
      if (status === 204) {
        resolvedPartyShortCircuit(res);
        return;
      }
      res.status(status).end();
      return;
    }

    const { tenant, party: activeParty, source, refreshedBearer } = guard;
    if (isTerminalStatus(activeParty.status as PartyStatus)) {
      resolvedPartyShortCircuit(res);
      return;
    }

    const extraHeaders: Record<string, string> = {};
    if (source === "cookie") {
      extraHeaders["Set-Cookie"] = serializeGuestCookie(
        activeParty.sessionToken,
      );
    }
    if (refreshedBearer) {
      extraHeaders[GUEST_REFRESH_HEADER] = refreshedBearer;
    }

    let unsubscribe: (() => Promise<void>) | null = null;

    const handle = await startSseStream(req, res, {
      extraHeaders,
      onSubscribe: async (h) => {
        unsubscribe = await subscribe(
          [channelForParty(activeParty.id), channelForTenantQueue(tenant.slug)],
          (event, channel) => {
            if (channel === channelForParty(activeParty.id)) {
              const ev = event as GuestStreamEvent;
              h.send({ data: ev });
              if (ev.type === "status_changed" && isTerminalStatus(ev.status)) {
                h.close();
              }
              return;
            }
            const tenantEvent = event as { type?: string };
            if (
              tenantEvent.type === "tenant:updated" ||
              tenantEvent.type === "tenant:opened" ||
              tenantEvent.type === "tenant:closed"
            ) {
              h.send({ data: tenantEvent as GuestStreamEvent });
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
      onClose: async (h) => {
        unregister(h);
        try {
          await unsubscribe?.();
        } catch (err) {
          log.warn("guest.stream.unsubscribe_failed", {
            slug,
            partyId,
            err: String(err),
          });
        }
      },
    });

    register(handle);
  }),
);
