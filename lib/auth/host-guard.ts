import type { NextRequest } from "next/server";

import type { Tenant } from "@/lib/db/schema";
import { loadTenantBySlug } from "@/lib/tenants/display-token";

import {
  HOST_COOKIE_NAME,
  clearHostCookieHeader,
  serializeHostCookie,
} from "./host-session";
import { maybeRefresh, verifyHostToken, type HostClaims } from "./host-token";

export type HostGuardDecision =
  | {
      ok: true;
      tenant: Tenant;
      claims: HostClaims;
      refreshedCookie: string | null;
    }
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
  req: Pick<NextRequest, "cookies">,
  slug: string,
  now: number = Date.now(),
): Promise<HostGuardDecision> {
  const cookie = req.cookies.get(HOST_COOKIE_NAME)?.value ?? null;

  let claims: HostClaims | null = null;
  let reason: HostGuardInput["reason"] = "missing";
  if (cookie) {
    const verified = await verifyHostToken(cookie);
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
    cookie,
    tenant: tenant
      ? { slug: tenant.slug, hostPasswordVersion: tenant.hostPasswordVersion }
      : null,
    claims,
    reason,
  });

  if (!decision.ok) return decision;

  let refreshedCookie: string | null = null;
  if (cookie) {
    const refresh = await maybeRefresh(cookie, now);
    if (refresh && refresh.refreshed) {
      refreshedCookie = serializeHostCookie(refresh.token);
    }
  }

  return {
    ok: true,
    tenant: tenant!,
    claims: decision.claims,
    refreshedCookie,
  };
}

export function clearHostCookieResponse(status: number): Response {
  return new Response(null, {
    status,
    headers: { "Set-Cookie": clearHostCookieHeader() },
  });
}

export function unauthorizedJson(
  status: 401 | 403 | 404,
  clearCookie: boolean,
  error: string,
): Response {
  const headers: Record<string, string> = {};
  if (clearCookie) headers["Set-Cookie"] = clearHostCookieHeader();
  return Response.json({ error }, { status, headers });
}
