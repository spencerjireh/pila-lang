import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";

import { guardHostRequest, unauthorizedJson } from "@/lib/auth/host-guard";
import { parties, type Party } from "@/lib/db/schema";
import { tenantDb } from "@/lib/db/tenant-scoped";
import { log } from "@/lib/log/logger";
import { undoPublishPlan } from "@/lib/parties/host-actions";
import { publishPositionUpdates } from "@/lib/parties/position";
import {
  isWithinUndoWindow,
  popUndoFrame,
} from "@/lib/parties/undo-store";
import { publish } from "@/lib/redis/pubsub";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const guard = await guardHostRequest(req, params.slug);
  if (!guard.ok) {
    return unauthorizedJson(guard.status, guard.clearCookie, guardError(guard.status));
  }
  const { tenant } = guard;

  const frame = await popUndoFrame(tenant.id);
  if (!frame) {
    return withRefresh(
      Response.json({ error: "no_action" }, { status: 409 }),
      guard.refreshedCookie,
    );
  }
  if (!isWithinUndoWindow(frame)) {
    return withRefresh(
      Response.json({ error: "too_old" }, { status: 409 }),
      guard.refreshedCookie,
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
    return withRefresh(
      Response.json({ error: "party_missing" }, { status: 409 }),
      guard.refreshedCookie,
    );
  }

  try {
    for (const { channel, event } of undoPublishPlan({ slug: tenant.slug, party: restored })) {
      await publish(channel, event);
    }
    await publishPositionUpdates(tenant.id, tenant.slug);
  } catch (err) {
    log.error("host.undo.publish_failed", {
      slug: params.slug,
      partyId: frame.partyId,
      err: String(err),
    });
  }

  log.info("host.undo.ok", { slug: params.slug, partyId: frame.partyId, action: frame.action });
  return withRefresh(
    Response.json({ ok: true, partyId: frame.partyId, action: frame.action }, { status: 200 }),
    guard.refreshedCookie,
  );
}

function guardError(status: 401 | 403 | 404): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  return "not_found";
}

function withRefresh(res: Response, cookie: string | null): Response {
  if (!cookie) return res;
  res.headers.append("Set-Cookie", cookie);
  return res;
}
