import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  requireAdminFromCookie,
  type AdminSession,
} from "@pila/shared/domain/auth/admin-guard";
import { ADMIN_COOKIE_NAME } from "@pila/shared/domain/auth/admin-jwt-cookie";

/**
 * Server-component admin session reader. Returns the session if the request
 * carries a valid admin cookie; null otherwise. Use in layouts/pages that
 * render different UI based on auth state but don't strictly require it.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const cookie = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const result = await requireAdminFromCookie(cookie);
  return result.ok ? result.admin : null;
}

/**
 * Hard guard for protected admin pages — redirects to /admin (login form)
 * if the cookie is missing, expired, tampered, or the email no longer
 * matches the allow list.
 */
export async function requireAdminPage(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) redirect("/admin");
  return session;
}
