import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "../../domain/auth/admin-session";
import { errorResponse } from "../../infra/http/error-response";
import { isAdminEmail } from "../../primitives/validators/admin-allow-list";

export type AdminSession = Session;

export async function requireAdmin(): Promise<AdminSession> {
  const session = (await auth()) as Session | null;
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    redirect("/admin");
  }
  return session;
}

export async function requireAdminApi(): Promise<
  { ok: true; session: AdminSession } | { ok: false; response: Response }
> {
  const session = (await auth()) as Session | null;
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return { ok: false, response: errorResponse(401, "unauthorized") };
  }
  return { ok: true, session };
}
