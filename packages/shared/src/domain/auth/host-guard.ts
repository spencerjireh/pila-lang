import type { Tenant } from "@pila/db/schema";
import { loadTenantBySlug } from "../../domain/tenants/display-token";
import type { RequestLike } from "../../primitives/http/request-like";

import { HOST_COOKIE_NAME, serializeHostCookie } from "./host-session";
import { maybeRefresh, verifyHostToken, type HostClaims } from "./host-token";
import { REFRESH_HEADER } from "./refresh-header";
import { resolveAuthSource } from "./source";

export const HOST_REFRESH_HEADER = REFRESH_HEADER;

export type HostGuardOk = {
  ok: true;
  tenant: Tenant;
  claims: HostClaims;
  source: "cookie" | "bearer";
  refreshedCookie: string | null;
  refreshedBearer: string | null;
};

export type HostGuardDecision =
  | HostGuardOk
  | { ok: false; status: 401 | 403 | 404; clearCookie: boolean };

export interface HostGuardInput {
  slug: string;
  cookie: string | null | undefined;
  tenant: Pick<Tenant, "slug" | "hostPasswordVersion"> | null;
  claims: HostClaims | null;
  reason: "ok" | "missing" | "invalid" | "expired";
}

export function decideHostGuard(
  input: HostGuardInput,
):
  | Exclude<HostGuardDecision, { ok: true }>
  | { ok: true; claims: HostClaims; tenantVersion: number } {
  if (!input.cookie || input.reason === "missing") {
    return { ok: false, status: 401, clearCookie: false };
  }
  if (input.reason !== "ok" || !input.claims) {
    return { ok: false, status: 401, clearCookie: true };
  }
  if (!input.tenant) return { ok: false, status: 404, clearCookie: false };
  if (input.claims.slug !== input.tenant.slug) {
    return { ok: false, status: 403, clearCookie: false };
  }
  if (input.claims.pwv < input.tenant.hostPasswordVersion) {
    return { ok: false, status: 401, clearCookie: true };
  }
  return {
    ok: true,
    claims: input.claims,
    tenantVersion: input.tenant.hostPasswordVersion,
  };
}

export async function guardHostRequest(
  req: RequestLike,
  slug: string,
  now: number = Date.now(),
): Promise<HostGuardDecision> {
  const { source, rawToken } = resolveAuthSource(req, HOST_COOKIE_NAME);

  let claims: HostClaims | null = null;
  let reason: HostGuardInput["reason"] = "missing";
  if (rawToken) {
    const verified = await verifyHostToken(rawToken);
    if (verified.ok) {
      claims = verified.claims;
      reason = "ok";
    } else {
      reason = verified.reason;
    }
  }

  const lookup = await loadTenantBySlug(slug);
  const tenant = lookup.ok ? lookup.tenant : null;

  const decision = decideHostGuard({
    slug,
    cookie: rawToken,
    tenant: tenant
      ? { slug: tenant.slug, hostPasswordVersion: tenant.hostPasswordVersion }
      : null,
    claims,
    reason,
  });

  if (!decision.ok) {
    return {
      ...decision,
      clearCookie: decision.clearCookie && source === "cookie",
    };
  }

  let refreshedCookie: string | null = null;
  let refreshedBearer: string | null = null;
  if (rawToken && source) {
    const refresh = await maybeRefresh(rawToken, now);
    if (refresh && refresh.refreshed) {
      if (source === "cookie") {
        refreshedCookie = serializeHostCookie(refresh.token);
      } else {
        refreshedBearer = refresh.token;
      }
    }
  }

  return {
    ok: true,
    tenant: tenant!,
    claims: decision.claims,
    source: source!,
    refreshedCookie,
    refreshedBearer,
  };
}
