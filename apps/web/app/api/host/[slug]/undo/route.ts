import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import {
  applyHostRefresh,
  guardHostRequest,
  hostGuardErrorResponse,
} from "@pila/shared/auth/host-guard";
import { parties, type Party } from "@pila/db/schema";
import { tenantDb } from "@pila/db/tenant-scoped";
import { log } from "@pila/shared/log/logger";
import { undoPublishPlan } from "@pila/shared/parties/host-actions";
import { publishPositionUpdates } from "@pila/shared/parties/position";
import {
  isWithinUndoWindow,
  popUndoFrame,
} from "@pila/shared/parties/undo-store";
import { publish } from "@pila/shared/redis/pubsub";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) return hostGuardErrorResponse(guard);
  const { tenant } = guard;

  const frame = await popUndoFrame(tenant.id);
  if (!frame) {
    return applyHostRefresh(
      Response.json({ error: "no_action" }, { status: 409 }),
      guard,
    );
  }
  if (!isWithinUndoWindow(frame)) {
    return applyHostRefresh(
      Response.json({ error: "too_old" }, { status: 409 }),
      guard,
    );
  }

  const scoped = tenantDb(tenant.id);
  const [restoredRow] = await scoped.parties
    .update(
      { status: "waiting", seatedAt: null, resolvedAt: null },
      eq(parties.id, frame.partyId),
    )
    .returning();
  const restored = restoredRow as Party | undefined;
  if (!restored) {
    log.warn("host.undo.party_missing", {
      slug: params.slug,
      partyId: frame.partyId,
    });
    return applyHostRefresh(
      Response.json({ error: "party_missing" }, { status: 409 }),
      guard,
    );
  }

  try {
    for (const { channel, event } of undoPublishPlan({
      slug: tenant.slug,
      party: restored,
    })) {
      await publish(channel, event);
    }
    await publishPositionUpdates(tenant.id);
  } catch (err) {
    log.error("host.undo.publish_failed", {
      slug: params.slug,
      partyId: frame.partyId,
      err: String(err),
    });
  }

  log.info("host.undo.ok", {
    slug: params.slug,
    partyId: frame.partyId,
    action: frame.action,
  });
  return applyHostRefresh(
    Response.json(
      { ok: true, partyId: frame.partyId, action: frame.action },
      { status: 200 },
    ),
    guard,
  );
}
