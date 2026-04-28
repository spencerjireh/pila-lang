import { and, eq } from "drizzle-orm";

import { parties, type Party, type PartyStatus } from "@pila/db/schema";
import { tenantDb } from "@pila/db/tenant-scoped";
import {
  channelForParty,
  channelForTenantQueue,
  publish,
} from "../../infra/redis/pubsub";

import { publishPositionUpdates } from "./position";

export type LeaveOutcome = "ok" | "not_found" | "conflict";

export function classifyLeave(
  party: { status: PartyStatus } | null | undefined,
): LeaveOutcome {
  if (!party) return "not_found";
  if (party.status !== "waiting") return "conflict";
  return "ok";
}

export interface LeavePublishStep {
  channel: string;
  event: unknown;
}

export function leavePublishPlan(args: {
  partyId: string;
  slug: string;
  resolvedAt: string;
}): LeavePublishStep[] {
  return [
    {
      channel: channelForParty(args.partyId),
      event: {
        type: "status_changed",
        status: "left",
        resolvedAt: args.resolvedAt,
      },
    },
    {
      channel: channelForTenantQueue(args.slug),
      event: {
        type: "party:left",
        id: args.partyId,
        status: "left",
        resolvedAt: args.resolvedAt,
      },
    },
  ];
}

export type LeaveResult =
  | { ok: true; resolvedAt: string }
  | { ok: false; reason: "not_found" | "conflict" };

export async function leaveQueue(
  tenantId: string,
  slug: string,
  partyId: string,
): Promise<LeaveResult> {
  const scoped = tenantDb(tenantId);

  const [updated] = await scoped.parties
    .update(
      { status: "left", resolvedAt: new Date() },
      and(eq(parties.id, partyId), eq(parties.status, "waiting")),
    )
    .returning();
  if (!updated) {
    const [row] = await scoped.parties.select(eq(parties.id, partyId));
    return { ok: false, reason: row ? "conflict" : "not_found" };
  }

  const resolvedAt = (updated as Party).resolvedAt!.toISOString();

  await Promise.all([
    ...leavePublishPlan({ partyId, slug, resolvedAt }).map(
      ({ channel, event }) => publish(channel, event),
    ),
    publishPositionUpdates(tenantId),
  ]);

  return { ok: true, resolvedAt };
}
