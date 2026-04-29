import { Router } from "express";
import { eq } from "drizzle-orm";

import { parties, type Party } from "@pila/db/schema";
import { tenantDb } from "@pila/db/tenant-scoped";
import { undoPublishPlan } from "@pila/shared/domain/parties/host-actions";
import { publishPositionUpdates } from "@pila/shared/domain/parties/position";
import {
  isWithinUndoWindow,
  popUndoFrame,
} from "@pila/shared/domain/parties/undo-store";
import { publish } from "@pila/shared/infra/redis/pubsub";

import { enforceRateLimits } from "../../lib/rate-limit.js";
import { requireHost } from "../../middleware/require-host.js";

export const hostUndoRouter = Router();

hostUndoRouter.post("/host/:slug/undo", requireHost, async (req, res) => {
  const guard = req.hostGuard!;
  const slug = guard.tenant.slug;

  const limited = await enforceRateLimits(res, [
    { bucket: "hostMutationPerSlug", key: slug },
  ]);
  if (limited) return;

  const frame = await popUndoFrame(guard.tenant.id);
  if (!frame) {
    res.status(409).json({ error: "no_action" });
    return;
  }
  if (!isWithinUndoWindow(frame)) {
    res.status(409).json({ error: "too_old" });
    return;
  }

  const scoped = tenantDb(guard.tenant.id);
  const [restoredRow] = await scoped.parties
    .update(
      { status: "waiting", seatedAt: null, resolvedAt: null },
      eq(parties.id, frame.partyId),
    )
    .returning();
  const restored = restoredRow as Party | undefined;
  if (!restored) {
    req.log.warn({ slug, partyId: frame.partyId }, "host.undo.party_missing");
    res.status(409).json({ error: "party_missing" });
    return;
  }

  try {
    await Promise.all([
      ...undoPublishPlan({ slug, party: restored }).map(({ channel, event }) =>
        publish(channel, event),
      ),
      publishPositionUpdates(guard.tenant.id),
    ]);
  } catch (err) {
    req.log.error(
      {
        slug,
        partyId: frame.partyId,
        err: String(err),
      },
      "host.undo.publish_failed",
    );
  }

  req.log.info(
    {
      slug,
      partyId: frame.partyId,
      action: frame.action,
    },
    "host.undo.ok",
  );
  res.json({ ok: true, partyId: frame.partyId, action: frame.action });
});
