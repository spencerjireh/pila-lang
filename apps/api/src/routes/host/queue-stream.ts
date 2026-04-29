import { Router } from "express";

import {
  guardHostRequest,
  HOST_REFRESH_HEADER,
} from "@pila/shared/domain/auth/host-guard";
import {
  buildHostSnapshot,
  loadRecentlyResolved,
  loadWaiting,
  type HostStreamDiff,
} from "@pila/shared/domain/parties/host-stream";
import { log } from "@pila/shared/infra/log/logger";
import {
  channelForTenantQueue,
  subscribe,
} from "@pila/shared/infra/redis/pubsub";
import { startSseStream } from "@pila/shared/infra/sse/stream";

import { asyncHandler } from "../../lib/async-handler.js";
import { expressToRequestLike } from "../../lib/express-request-like.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";
import { register, unregister } from "../../lib/sse-registry.js";

export const hostQueueStreamRouter = Router();

hostQueueStreamRouter.get(
  "/host/:slug/queue/stream",
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug ?? "");
    if (!slug) {
      res.status(404).end();
      return;
    }

    const limited = await enforceRateLimits(res, [
      {
        bucket: "hostStreamPerIpSlug",
        key: `${req.ip ?? "unknown"}:${slug}`,
      },
    ]);
    if (limited) return;

    // Sprint 5 swaps this for a require-host middleware factory.
    const guard = await guardHostRequest(expressToRequestLike(req), slug);
    if (!guard.ok) {
      if (guard.clearCookie) {
        // Match the host-session cookie clearer used elsewhere.
        const { clearHostCookieHeader } =
          await import("@pila/shared/domain/auth/host-session");
        res.setHeader("Set-Cookie", clearHostCookieHeader());
      }
      res.status(guard.status).json({
        error:
          guard.status === 401
            ? "unauthorized"
            : guard.status === 403
              ? "forbidden"
              : "not_found",
      });
      return;
    }
    const { tenant } = guard;

    const extraHeaders: Record<string, string> = {};
    if (guard.refreshedCookie)
      extraHeaders["Set-Cookie"] = guard.refreshedCookie;
    if (guard.refreshedBearer)
      extraHeaders[HOST_REFRESH_HEADER] = guard.refreshedBearer;

    let unsubscribe: (() => Promise<void>) | null = null;

    const handle = await startSseStream(req, res, {
      extraHeaders,
      onSubscribe: async (h) => {
        unsubscribe = await subscribe(
          [channelForTenantQueue(tenant.slug)],
          (event) => {
            h.send({ data: event as HostStreamDiff });
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
      onClose: async (h) => {
        unregister(h);
        try {
          await unsubscribe?.();
        } catch (err) {
          log.warn("host.stream.unsubscribe_failed", {
            slug,
            err: String(err),
          });
        }
      },
    });

    register(handle);
  }),
);
