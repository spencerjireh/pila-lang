import { Router } from "express";

import { loadTenantBySlug } from "@pila/shared/domain/tenants/lookup";
import {
  channelForTenantQueue,
  subscribe,
} from "@pila/shared/infra/redis/pubsub";
import { startSseStream } from "@pila/shared/infra/sse/stream";

import { param } from "../../lib/params.js";
import { enforceRateLimits } from "../../lib/rate-limit.js";
import { register, unregister } from "../../lib/sse-registry.js";

export const displayStreamRouter = Router();

displayStreamRouter.get("/display/:slug/stream", async (req, res) => {
  const limited = await enforceRateLimits(res, [
    { bucket: "displayRequestsPerIp", key: req.ip ?? "unknown" },
  ]);
  if (limited) return;

  const slug = param(req, "slug");
  if (!slug) {
    res.status(404).end();
    return;
  }
  const lookup = await loadTenantBySlug(slug);
  if (!lookup.ok) {
    res.status(404).end();
    return;
  }
  const tenant = lookup.tenant;

  let unsubscribe: (() => Promise<void>) | null = null;

  const handle = await startSseStream(req, res, {
    onSubscribe: async (h) => {
      unsubscribe = await subscribe(
        [channelForTenantQueue(tenant.slug)],
        (event) => {
          const ev = event as { type?: string };
          if (
            ev.type === "tenant:updated" ||
            ev.type === "tenant:opened" ||
            ev.type === "tenant:closed"
          ) {
            h.send({ data: ev });
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
          "display.stream.unsubscribe_failed",
        );
      }
    },
  });

  register(handle);
});
