import { asc, eq } from "drizzle-orm";

import { parties } from "@pila/db/schema";
import { tenantDb } from "@pila/db/tenant-scoped";
import { channelForParty, publish } from "../../infra/redis/pubsub";

import type { GuestPositionChangedEvent } from "./stream-events";

export interface PositionEvent {
  channel: string;
  event: GuestPositionChangedEvent;
}

export function positionEventsFor(ids: readonly string[]): PositionEvent[] {
  return ids.map((id, i) => ({
    channel: channelForParty(id),
    event: { type: "position_changed", position: i + 1 },
  }));
}

export function rankOf(ids: readonly string[], partyId: string): number {
  const idx = ids.indexOf(partyId);
  return idx === -1 ? 0 : idx + 1;
}

async function listWaitingIdsInOrder(tenantId: string): Promise<string[]> {
  const rows = await tenantDb(tenantId)
    .parties.select(eq(parties.status, "waiting"))
    .orderBy(asc(parties.joinedAt));
  return rows.map((r) => r.id);
}

export async function computePosition(
  tenantId: string,
  partyId: string,
): Promise<number> {
  const ids = await listWaitingIdsInOrder(tenantId);
  return rankOf(ids, partyId);
}

export async function publishPositionUpdates(tenantId: string): Promise<void> {
  const ids = await listWaitingIdsInOrder(tenantId);
  for (const { channel, event } of positionEventsFor(ids)) {
    await publish(channel, event);
  }
}
