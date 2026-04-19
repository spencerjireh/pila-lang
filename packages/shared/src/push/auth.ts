import { parseBearer } from "../auth/bearer";
import { verifyGuestToken } from "../auth/guest-token";
import { verifyHostToken } from "../auth/host-token";
import { loadTenantBySlug } from "../tenants/display-token";

export type PushAuth =
  | {
      kind: "guest_party";
      tenantId: string;
      slug: string;
      scopeId: string;
    }
  | {
      kind: "host_session";
      tenantId: string;
      slug: string;
      scopeId: string;
    };

export async function authorizePushBearer(
  headers: Headers,
): Promise<PushAuth | null> {
  const token = parseBearer(headers.get("authorization"));
  if (!token) return null;

  const host = await verifyHostToken(token);
  if (host.ok) {
    const lookup = await loadTenantBySlug(host.claims.slug);
    if (!lookup.ok) return null;
    if (host.claims.pwv < lookup.tenant.hostPasswordVersion) return null;
    return {
      kind: "host_session",
      tenantId: lookup.tenant.id,
      slug: lookup.tenant.slug,
      scopeId: host.claims.jti,
    };
  }

  const guest = await verifyGuestToken(token);
  if (guest.ok) {
    const lookup = await loadTenantBySlug(guest.claims.slug);
    if (!lookup.ok) return null;
    return {
      kind: "guest_party",
      tenantId: lookup.tenant.id,
      slug: lookup.tenant.slug,
      scopeId: guest.claims.partyId,
    };
  }

  return null;
}
