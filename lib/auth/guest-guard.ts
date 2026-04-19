import type { NextRequest } from "next/server";

import type { Party, Tenant } from "@/lib/db/schema";
import { findPartyById } from "@/lib/parties/lookup";
import { loadTenantBySlug } from "@/lib/tenants/display-token";

import { parseBearer } from "./bearer";
import { GUEST_COOKIE_NAME } from "./guest-session";
import { maybeRefreshGuest, type GuestClaims } from "./guest-token";

export const GUEST_REFRESH_HEADER = "X-Refreshed-Token";

export type GuestGuardReason =
  | "unauthenticated"
  | "tenant_not_found"
  | "invalid_token"
  | "slug_mismatch"
  | "party_mismatch"
  | "party_not_found"
  | "wrong_tenant"
  | "session_mismatch";

export type GuestGuardOk = {
  ok: true;
  tenant: Tenant;
  party: Party;
  source: "cookie" | "bearer";
  refreshedBearer: string | null;
  claims: GuestClaims | null;
};

export type GuestGuardDecision =
  | GuestGuardOk
  | { ok: false; reason: GuestGuardReason };

export async function guardGuestRequest(
  req: Pick<NextRequest, "cookies" | "headers">,
  slug: string,
  partyId: string,
  now: number = Date.now(),
): Promise<GuestGuardDecision> {
  const cookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  const bearer = parseBearer(req.headers.get("authorization"));
  const source: "cookie" | "bearer" | null = cookie
    ? "cookie"
    : bearer
      ? "bearer"
      : null;

  if (!source) return { ok: false, reason: "unauthenticated" };

  const lookup = await loadTenantBySlug(slug);
  if (!lookup.ok) return { ok: false, reason: "tenant_not_found" };
  const tenant = lookup.tenant;

  let claims: GuestClaims | null = null;
  let refreshedBearer: string | null = null;
  if (source === "bearer" && bearer) {
    const refresh = await maybeRefreshGuest(bearer, now);
    if (!refresh) return { ok: false, reason: "invalid_token" };
    claims = refresh.claims;
    if (refresh.refreshed) refreshedBearer = refresh.token;
    if (claims.slug !== slug) return { ok: false, reason: "slug_mismatch" };
    if (claims.partyId !== partyId) {
      return { ok: false, reason: "party_mismatch" };
    }
  }

  const party = await findPartyById(tenant.id, partyId);
  if (!party) return { ok: false, reason: "party_not_found" };
  if (party.tenantId !== tenant.id) {
    return { ok: false, reason: "wrong_tenant" };
  }

  if (source === "cookie" && party.sessionToken !== cookie) {
    return { ok: false, reason: "session_mismatch" };
  }

  return { ok: true, tenant, party, source, refreshedBearer, claims };
}

export type GuestGuardMode = "stream" | "action";

export function statusForGuestFailure(
  reason: GuestGuardReason,
  mode: GuestGuardMode,
): 204 | 401 | 403 | 404 {
  switch (reason) {
    case "unauthenticated":
    case "invalid_token":
      return 401;
    case "tenant_not_found":
      return 404;
    case "slug_mismatch":
    case "party_mismatch":
    case "wrong_tenant":
    case "session_mismatch":
      return 403;
    case "party_not_found":
      return mode === "stream" ? 204 : 404;
  }
}

export function applyGuestRefresh(
  res: Response,
  guard: GuestGuardOk,
): Response {
  if (guard.refreshedBearer) {
    res.headers.set(GUEST_REFRESH_HEADER, guard.refreshedBearer);
  }
  return res;
}

export function guestRefreshHeaders(
  guard: GuestGuardOk,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (guard.refreshedBearer)
    headers[GUEST_REFRESH_HEADER] = guard.refreshedBearer;
  return headers;
}
