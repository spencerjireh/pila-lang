import type { NextRequest } from "next/server";

import type { Tenant } from "@pila/db/schema";
import { loadTenantBySlug } from "../tenants/display-token";

import { parseBearer } from "./bearer";
import {
  HOST_COOKIE_NAME,
  clearHostCookieHeader,
  serializeHostCookie,
} from "./host-session";
import { maybeRefresh, verifyHostToken, type HostClaims } from "./host-token";

export const HOST_REFRESH_HEADER = "X-Refreshed-Token";

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
  req: Pick<NextRequest, "cookies" | "headers">,
  slug: string,
  now: number = Date.now(),
): Promise<HostGuardDecision> {
  const cookie = req.cookies.get(HOST_COOKIE_NAME)?.value ?? null;
  const bearer = parseBearer(req.headers.get("authorization"));
  const source: "cookie" | "bearer" | null = cookie
    ? "cookie"
    : bearer
      ? "bearer"
      : null;
  const rawToken = cookie ?? bearer;

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

export function applyHostRefresh(res: Response, guard: HostGuardOk): Response {
  if (guard.refreshedCookie) {
    res.headers.append("Set-Cookie", guard.refreshedCookie);
  }
  if (guard.refreshedBearer) {
    res.headers.set(HOST_REFRESH_HEADER, guard.refreshedBearer);
  }
  return res;
}
