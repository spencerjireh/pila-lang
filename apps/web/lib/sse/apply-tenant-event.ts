/**
 * Merge a tenant:* pubsub event into a tenant-brand state object. Shared
 * between wait-view, queue-view, and display-client so all three surfaces
 * apply the same fields with the same precedence.
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

export function applyTenantEvent<T extends TenantBrandSlice>(
  prev: T,
  ev: TenantLiveEvent,
): T {
  if (ev.type === "tenant:updated") {
    return {
      ...prev,
      ...(ev.name !== undefined ? { name: ev.name } : {}),
      ...(ev.logoUrl !== undefined ? { logoUrl: ev.logoUrl } : {}),
      ...(ev.accentColor !== undefined ? { accentColor: ev.accentColor } : {}),
    };
  }
  if (ev.type === "tenant:opened") return { ...prev, isOpen: true };
  if (ev.type === "tenant:closed") return { ...prev, isOpen: false };
  return prev;
}
