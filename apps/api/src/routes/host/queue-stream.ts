import { Router } from "express";

import {
  buildHostSnapshot,
  loadRecentlyResolved,
  loadWaiting,
  type HostStreamDiff,
} from "@pila/shared/domain/parties/host-stream";
import {
  channelForTenantQueue,
  subscribe,
} from "@pila/shared/infra/redis/pubsub";
import { startSseStream } from "@pila/shared/infra/sse/stream";

import { enforceRateLimits } from "../../lib/rate-limit.js";
import { register, unregister } from "../../lib/sse-registry.js";
import { requireHost } from "../../middleware/require-host.js";

export const hostQueueStreamRouter = Router();

hostQueueStreamRouter.get(
  "/host/:slug/queue/stream",
  requireHost,
  async (req, res) => {
    const tenant = req.hostGuard!.tenant;
    const slug = tenant.slug;

    const limited = await enforceRateLimits(res, [
      {
        bucket: "hostStreamPerIpSlug",
        key: `${req.ip ?? "unknown"}:${slug}`,
      },
    ]);
    if (limited) return;

    // requireHost has already called res.setHeader for refresh cookie/bearer
    // (if any). startSseStream's flushHeaders() will send them with the SSE
    // response head — no need to re-pass via extraHeaders.

    let unsubscribe: (() => Promise<void>) | null = null;

    const handle = await startSseStream(req, res, {
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
          req.log.warn(
            {
              slug,
              err: String(err),
            },
            "host.stream.unsubscribe_failed",
          );
        }
      },
    });

    register(handle);
  },
);
