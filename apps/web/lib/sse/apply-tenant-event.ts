/**
 * Merge a tenant:* pubsub event into a tenant-brand state object. Shared
 * between wait-view, queue-view, and display-client so all three surfaces
 * apply the same fields with the same precedence.
 *
 * `tenant:reset` returns `{ kind: "reset" }` — surfaces decide what to do
 * (queue-view triggers router.refresh; wait-view and display-client ignore it).
 */

export interface TenantBrandSlice {
  name?: string;
  logoUrl?: string | null;
  accentColor?: string;
  isOpen?: boolean;
}

export interface TenantLiveEvent {
  type?: string;
  name?: string;
  logoUrl?: string | null;
  accentColor?: string;
}

export type TenantEventOutcome<T> =
  | { kind: "patched"; state: T }
  | { kind: "reset" };

export function applyTenantEvent<T extends TenantBrandSlice>(
  prev: T,
  ev: TenantLiveEvent,
): TenantEventOutcome<T> {
  if (ev.type === "tenant:reset") return { kind: "reset" };
  if (ev.type === "tenant:updated") {
    return {
      kind: "patched",
      state: {
        ...prev,
        ...(ev.name !== undefined ? { name: ev.name } : {}),
        ...(ev.logoUrl !== undefined ? { logoUrl: ev.logoUrl } : {}),
        ...(ev.accentColor !== undefined
          ? { accentColor: ev.accentColor }
          : {}),
      },
    };
  }
  if (ev.type === "tenant:opened") {
    return { kind: "patched", state: { ...prev, isOpen: true } };
  }
  if (ev.type === "tenant:closed") {
    return { kind: "patched", state: { ...prev, isOpen: false } };
  }
  return { kind: "patched", state: prev };
}
