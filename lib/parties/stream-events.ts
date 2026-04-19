import type { PartyStatus } from "@/lib/db/schema";

export interface GuestSnapshotEvent {
  type: "snapshot";
  status: PartyStatus;
  position: number;
  name: string;
  joinedAt: string;
}

export interface GuestPositionChangedEvent {
  type: "position_changed";
  position: number;
}

export interface GuestStatusChangedEvent {
  type: "status_changed";
  status: PartyStatus;
  resolvedAt?: string | null;
}

export type GuestStreamEvent =
  | GuestSnapshotEvent
  | GuestPositionChangedEvent
  | GuestStatusChangedEvent
  | TenantUpdated
  | TenantOpenClose;

export interface TenantPartyJoined {
  type: "party:joined";
  id: string;
  name: string;
  partySize: number;
  phone: string | null;
  joinedAt: string;
}

export interface TenantPartyResolved {
  type: "party:seated" | "party:removed" | "party:left";
  id: string;
  status: PartyStatus;
  resolvedAt: string;
}

export interface TenantPartyRestored {
  type: "party:restored";
  id: string;
  name: string;
  partySize: number;
  phone: string | null;
  joinedAt: string;
}

export interface TenantOpenClose {
  type: "tenant:opened" | "tenant:closed" | "tenant:reset";
}

export interface TenantUpdated {
  type: "tenant:updated";
  name?: string;
  logoUrl?: string | null;
  accentColor?: string;
}

export type TenantQueueEvent =
  | TenantPartyJoined
  | TenantPartyResolved
  | TenantPartyRestored
  | TenantOpenClose
  | TenantUpdated;

export function isTerminalStatus(status: PartyStatus): boolean {
  return status === "seated" || status === "no_show" || status === "left";
}

export function buildGuestSnapshot(input: {
  status: PartyStatus;
  position: number;
  name: string;
  joinedAt: Date | string;
}): GuestSnapshotEvent {
  return {
    type: "snapshot",
    status: input.status,
    position: input.position,
    name: input.name,
    joinedAt:
      typeof input.joinedAt === "string"
        ? input.joinedAt
        : input.joinedAt.toISOString(),
  };
}
