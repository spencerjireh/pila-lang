import { and, asc, desc, eq, gt, inArray } from "drizzle-orm";

import {
  parties,
  type Party,
  type PartyStatus,
  type Tenant,
} from "@/lib/db/schema";
import { tenantDb } from "@/lib/db/tenant-scoped";

import type {
  TenantPartyJoined,
  TenantPartyResolved,
  TenantPartyRestored,
  TenantOpenClose,
  TenantUpdated,
} from "./stream-events";

const RECENTLY_RESOLVED_LIMIT = 10;
const RECENTLY_RESOLVED_WINDOW_MS = 30 * 60 * 1000;

export interface HostWaitingRow {
  id: string;
  name: string;
  partySize: number;
  phone: string | null;
  joinedAt: string;
}

export interface HostRecentlyResolvedRow {
  id: string;
  name: string;
  partySize: number;
  status: PartyStatus;
  resolvedAt: string;
}

export interface HostSnapshotEvent {
  type: "snapshot";
  tenant: {
    slug: string;
    name: string;
    isOpen: boolean;
    logoUrl: string | null;
    accentColor: string;
    timezone: string;
  };
  waiting: HostWaitingRow[];
  recentlyResolved: HostRecentlyResolvedRow[];
}

export type HostStreamDiff =
  | TenantPartyJoined
  | TenantPartyResolved
  | TenantPartyRestored
  | TenantOpenClose
  | TenantUpdated;

export type HostStreamEvent = HostSnapshotEvent | HostStreamDiff;

export function toWaitingRow(p: Party): HostWaitingRow {
  return {
    id: p.id,
    name: p.name,
    partySize: p.partySize,
    phone: p.phone,
    joinedAt: p.joinedAt.toISOString(),
  };
}

export function toRecentlyResolvedRow(p: Party): HostRecentlyResolvedRow {
  return {
    id: p.id,
    name: p.name,
    partySize: p.partySize,
    status: p.status as PartyStatus,
    resolvedAt: (p.resolvedAt ?? p.joinedAt).toISOString(),
  };
}

export async function loadWaiting(tenantId: string): Promise<HostWaitingRow[]> {
  const rows = await tenantDb(tenantId)
    .parties.select(eq(parties.status, "waiting"))
    .orderBy(asc(parties.joinedAt));
  return rows.map((r) => toWaitingRow(r as Party));
}

export async function loadRecentlyResolved(
  tenantId: string,
  now: Date = new Date(),
): Promise<HostRecentlyResolvedRow[]> {
  const threshold = new Date(now.getTime() - RECENTLY_RESOLVED_WINDOW_MS);
  const rows = await tenantDb(tenantId)
    .parties.select(
      and(
        inArray(parties.status, ["seated", "no_show", "left"]),
        gt(parties.resolvedAt, threshold),
      )!,
    )
    .orderBy(desc(parties.resolvedAt))
    .limit(RECENTLY_RESOLVED_LIMIT);
  return rows.map((r) => toRecentlyResolvedRow(r as Party));
}

export function buildHostSnapshot(
  tenant: Pick<
    Tenant,
    "slug" | "name" | "isOpen" | "logoUrl" | "accentColor" | "timezone"
  >,
  waiting: HostWaitingRow[],
  recentlyResolved: HostRecentlyResolvedRow[],
): HostSnapshotEvent {
  return {
    type: "snapshot",
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      isOpen: tenant.isOpen,
      logoUrl: tenant.logoUrl,
      accentColor: tenant.accentColor,
      timezone: tenant.timezone,
    },
    waiting,
    recentlyResolved,
  };
}

export const HOST_RECENTLY_RESOLVED_WINDOW_MS = RECENTLY_RESOLVED_WINDOW_MS;
export const HOST_RECENTLY_RESOLVED_LIMIT = RECENTLY_RESOLVED_LIMIT;

export const HOST_RESOLVED_STATUSES = [
  "seated",
  "no_show",
  "left",
] as const satisfies readonly PartyStatus[];

export function isResolvedRow(
  p: Pick<Party, "status" | "resolvedAt">,
  now: Date = new Date(),
): boolean {
  if (
    !HOST_RESOLVED_STATUSES.includes(
      p.status as (typeof HOST_RESOLVED_STATUSES)[number],
    )
  ) {
    return false;
  }
  if (!p.resolvedAt) return false;
  return now.getTime() - p.resolvedAt.getTime() < RECENTLY_RESOLVED_WINDOW_MS;
}
