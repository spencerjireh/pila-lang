import { redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/lib/auth/admin-session";
import { isAdminEmail } from "@/lib/validators/admin-allow-list";

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
    return {
      ok: false,
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  return { ok: true, session };
}
