import { eq } from "drizzle-orm";

import { parties, type Party, type PartyStatus } from "@/lib/db/schema";
import { tenantDb } from "@/lib/db/tenant-scoped";
import {
  channelForParty,
  channelForTenantQueue,
  publish,
} from "@/lib/redis/pubsub";

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
  const [row] = await scoped.parties.select(eq(parties.id, partyId));
  const typedRow = row as Party | undefined;
  const outcome = classifyLeave(
    typedRow ? { status: typedRow.status as PartyStatus } : typedRow,
  );
  if (outcome === "not_found") return { ok: false, reason: "not_found" };
  if (outcome === "conflict") return { ok: false, reason: "conflict" };

  const [updated] = await scoped.parties
    .update(
      { status: "left", resolvedAt: new Date() },
      eq(parties.id, partyId),
    )
    .returning();
  const resolvedAt = (updated as Party).resolvedAt!.toISOString();

  for (const { channel, event } of leavePublishPlan({ partyId, slug, resolvedAt })) {
    await publish(channel, event);
  }
  await publishPositionUpdates(tenantId, slug);

  return { ok: true, resolvedAt };
}
