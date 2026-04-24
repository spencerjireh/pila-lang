import { and, eq } from "drizzle-orm";

import { parties, type Party, type PartyStatus } from "@pila/db/schema";
import { tenantDb } from "@pila/db/tenant-scoped";
import { log } from "../log/logger";
import { notifier } from "../notifier";
import {
  channelForParty,
  channelForTenantQueue,
  publish,
} from "../redis/pubsub";

import { publishPositionUpdates } from "./position";
import type { TenantPartyResolved, TenantPartyRestored } from "./stream-events";
import { pushUndoFrame, type UndoAction, type UndoFrame } from "./undo-store";

export type HostAction = UndoAction;

export type HostActionResult =
  | { ok: true; party: Party; resolvedAt: string }
  | { ok: false; reason: "not_found" | "conflict" };

export interface HostPublishStep {
  channel: string;
  event: unknown;
}

interface PublishOrderInput {
  slug: string;
  partyId: string;
  action: HostAction;
  resolvedAt: string;
}

export function hostActionPublishPlan({
  slug,
  partyId,
  action,
  resolvedAt,
}: PublishOrderInput): HostPublishStep[] {
  const terminalStatus: PartyStatus = action === "seat" ? "seated" : "no_show";
  const tenantEventType: TenantPartyResolved["type"] =
    action === "seat" ? "party:seated" : "party:removed";
  return [
    {
      channel: channelForTenantQueue(slug),
      event: {
        type: tenantEventType,
        id: partyId,
        status: terminalStatus,
        resolvedAt,
      } satisfies TenantPartyResolved,
    },
    {
      channel: channelForParty(partyId),
      event: {
        type: "status_changed",
        status: terminalStatus,
        resolvedAt,
      },
    },
  ];
}

export async function performHostAction(
  tenantId: string,
  slug: string,
  partyId: string,
  action: HostAction,
): Promise<HostActionResult> {
  const scoped = tenantDb(tenantId);
  const resolvedAtDate = new Date();
  const update: Partial<typeof parties.$inferInsert> =
    action === "seat"
      ? {
          status: "seated",
          seatedAt: resolvedAtDate,
          resolvedAt: resolvedAtDate,
        }
      : { status: "no_show", resolvedAt: resolvedAtDate };

  const [updated] = await scoped.parties
    .update(update, and(eq(parties.id, partyId), eq(parties.status, "waiting")))
    .returning();
  if (!updated) {
    const [row] = await scoped.parties.select(eq(parties.id, partyId));
    return { ok: false, reason: row ? "conflict" : "not_found" };
  }
  const updatedParty = updated as Party;
  const resolvedAt = updatedParty.resolvedAt!.toISOString();

  const frame: UndoFrame = {
    action,
    partyId,
    previousStatus: "waiting",
    timestamp: Date.now(),
  };
  await pushUndoFrame(tenantId, frame);

  for (const { channel, event } of hostActionPublishPlan({
    slug,
    partyId,
    action,
    resolvedAt,
  })) {
    await publish(channel, event);
  }
  await publishPositionUpdates(tenantId);

  if (action === "seat") {
    try {
      await notifier().onPartyReady(updatedParty);
    } catch (err) {
      log.error("notifier.onPartyReady.failed", {
        partyId: updatedParty.id,
        err: String(err),
      });
    }
  }

  return { ok: true, party: updatedParty, resolvedAt };
}

export type UndoOutcome =
  | { ok: true; party: Party }
  | { ok: false; reason: "no_frame" | "too_old" | "party_missing" };

export interface UndoPublishInput {
  slug: string;
  party: Party;
}

export function undoPublishPlan({
  slug,
  party,
}: UndoPublishInput): HostPublishStep[] {
  return [
    {
      channel: channelForParty(party.id),
      event: {
        type: "status_changed",
        status: "waiting",
      },
    },
    {
      channel: channelForTenantQueue(slug),
      event: {
        type: "party:restored",
        id: party.id,
        name: party.name,
        partySize: party.partySize,
        phone: party.phone,
        joinedAt: party.joinedAt.toISOString(),
      } satisfies TenantPartyRestored,
    },
  ];
}
