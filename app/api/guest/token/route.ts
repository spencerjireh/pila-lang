import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";

import { GUEST_COOKIE_NAME } from "@/lib/auth/guest-session";
import {
  GUEST_TOKEN_TTL_SECONDS,
  signGuestToken,
} from "@/lib/auth/guest-token";
import { parties } from "@/lib/db/schema";
import { getDb } from "@/lib/db/client";
import { clientIp, rateLimitResponse } from "@/lib/http/client-ip";
import { log } from "@/lib/log/logger";
import { RateLimitError, consume } from "@/lib/ratelimit";
import { loadTenantBySlug } from "@/lib/tenants/display-token";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  slug: z.string().min(1).max(64),
  partyId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "bad_content_type" }, { status: 415 });
  }

  const cookie = req.cookies.get(GUEST_COOKIE_NAME)?.value ?? null;
  if (!cookie) return Response.json({ error: "unauthorized" }, { status: 401 });

  const ip = clientIp(req.headers);
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return Response.json({ error: "invalid_body" }, { status: 400 });

  try {
    await consume("guestTokenPerIp", ip);
  } catch (err) {
    if (err instanceof RateLimitError)
      return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  const lookup = await loadTenantBySlug(parsed.data.slug);
  if (!lookup.ok) return Response.json({ error: "not_found" }, { status: 404 });
  const tenant = lookup.tenant;

  const [row] = await getDb()
    .select()
    .from(parties)
    .where(eq(parties.id, parsed.data.partyId));
  if (!row) return Response.json({ error: "not_found" }, { status: 404 });
  if (row.tenantId !== tenant.id)
    return Response.json({ error: "forbidden" }, { status: 403 });
  if (row.sessionToken !== cookie)
    return Response.json({ error: "forbidden" }, { status: 403 });

  const token = await signGuestToken({
    slug: tenant.slug,
    partyId: row.id,
  });

  log.info("guest.token.issued", { slug: tenant.slug, partyId: row.id });
  return Response.json(
    {
      token,
      tokenType: "Bearer",
      expiresIn: GUEST_TOKEN_TTL_SECONDS,
      slug: tenant.slug,
      partyId: row.id,
    },
    { status: 200 },
  );
}
