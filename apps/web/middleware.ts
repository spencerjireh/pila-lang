import { NextResponse, type NextRequest } from "next/server";

import {
  ADMIN_COOKIE_NAME,
  verifyAdminSession,
} from "@pila/shared/domain/auth/admin-jwt-cookie";
import { HOST_COOKIE_NAME } from "@pila/shared/domain/auth/host-session";
import { verifyHostToken } from "@pila/shared/domain/auth/host-token";

/**
 * Edge page-guard middleware. Redirects unauthenticated requests to the
 * surface's login screen so protected pages never render shell + flash.
 *
 * apps/api still independently verifies on every API request — defence in
 * depth. Middleware verifies the JWT signature only; the full guard
 * (DB-backed pwv check for host, allow-list re-check for admin) runs on
 * the API side.
 *
 * IMPORTANT: this file runs in the Edge runtime. Do NOT import anything
 * that pulls Node-only deps (pg, ioredis, bcrypt, sharp, pino). Imports
 * here are limited to jose-only modules in @pila/shared/domain/auth.
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin/tenants")) {
    const cookie = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
    const result = await verifyAdminSession(cookie);
    if (!result.ok) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    return NextResponse.next();
  }

  // Host: gate /host/[slug]/queue, /settings, /guests. The bare
  // /host/[slug] route is the login form, so it must remain reachable.
  const hostMatch = pathname.match(/^\/host\/([^/]+)\/(queue|settings|guests)/);
  if (hostMatch) {
    const slug = hostMatch[1]!;
    const cookie = req.cookies.get(HOST_COOKIE_NAME)?.value;
    if (!cookie) {
      return NextResponse.redirect(new URL(`/host/${slug}`, req.url));
    }
    const verified = await verifyHostToken(cookie);
    if (!verified.ok || verified.claims.slug !== slug) {
      return NextResponse.redirect(new URL(`/host/${slug}`, req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Broad matcher; the protected-subpath set is enforced by the regex inside
  // the handler so the list lives in one place. The bare /host/[slug] login
  // form falls through to NextResponse.next() because the regex requires a
  // third path segment.
  matcher: ["/admin/tenants/:path*", "/host/:path*"],
};
