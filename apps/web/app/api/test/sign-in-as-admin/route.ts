import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { getDb } from "@pila/db/client";
import { sessions, users } from "@pila/db/schema";
import { requireTestEnv } from "@pila/shared/test-api/guard";
import { isAdminEmail } from "@pila/shared/validators/admin-allow-list";

const bodySchema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const guard = requireTestEnv();
  if (guard) return guard;

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  if (!isAdminEmail(email)) {
    return Response.json({ error: "not_allow_listed" }, { status: 403 });
  }

  const db = getDb();
  let [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email, emailVerified: new Date() })
      .returning({ id: users.id });
  }

  const token = randomUUID() + "." + randomUUID();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await db
    .insert(sessions)
    .values({ sessionToken: token, userId: user!.id, expires });

  const isHttps = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const cookieName = isHttps
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const attrs = [
    `${cookieName}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expires.toUTCString()}`,
  ];
  if (isHttps) attrs.push("Secure");

  return new Response(
    JSON.stringify({ ok: true, userId: user!.id, cookieName, token }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        "set-cookie": attrs.join("; "),
      },
    },
  );
}
