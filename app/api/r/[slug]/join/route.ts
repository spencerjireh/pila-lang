import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  GUEST_COOKIE_MAX_AGE,
  GUEST_COOKIE_NAME,
  guestCookieAttrs,
} from "@/lib/auth/guest-session";
import { clientIp, rateLimitResponse } from "@/lib/http/client-ip";
import { log } from "@/lib/log/logger";
import { joinQueue } from "@/lib/parties/join";
import { verifyQrToken } from "@/lib/qr/token";
import { RateLimitError, consume } from "@/lib/ratelimit";

const WELCOME_BACK_COOKIE = "welcome_back";
const WELCOME_BACK_MAX_AGE = 5 * 60;

const joinSchema = z.object({
  name: z.string().trim().min(1, "name_required").max(80),
  partySize: z.number().int().min(1).max(20),
  phone: z
    .union([
      z.string().trim().regex(/^\+[1-9]\d{5,14}$/u, "bad_phone"),
      z.literal(""),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v && v !== "" ? v : null)),
});

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return Response.json({ error: "bad_content_type" }, { status: 415 });
  }

  const token = req.nextUrl.searchParams.get("t");
  if (!token) return Response.json({ error: "missing_token" }, { status: 401 });
  const verdict = verifyQrToken(params.slug, token);
  if (!verdict.ok) {
    return Response.json({ error: "invalid_token", reason: verdict.reason }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const input = parsed.data;

  const ip = clientIp(req.headers);
  try {
    if (input.phone) {
      await consume("joinPerPhone", input.phone);
    } else {
      await consume("joinPerIp", ip);
    }
    await consume("joinGlobalPerTenant", params.slug);
  } catch (err) {
    if (err instanceof RateLimitError) return rateLimitResponse(err.retryAfterSec);
    throw err;
  }

  let result;
  try {
    result = await joinQueue(params.slug, {
      name: input.name,
      partySize: input.partySize,
      phone: input.phone,
    });
  } catch (err) {
    log.error("join.failed", { slug: params.slug, err: String(err) });
    return Response.json({ error: "internal" }, { status: 500 });
  }

  if (!result.ok) {
    switch (result.reason) {
      case "not_found":
        return Response.json({ error: "not_found" }, { status: 404 });
      case "tenant_closed":
        return Response.json({ error: "tenant_closed" }, { status: 409 });
      case "already_waiting":
        return Response.json({ error: "already_waiting" }, { status: 409 });
    }
  }

  log.info("party.joined", {
    slug: params.slug,
    partyId: result.party.id,
    phoneSeenBefore: result.phoneSeenBefore,
  });

  const res = NextResponse.json(
    { partyId: result.party.id, waitUrl: result.waitUrl },
    { status: 201 },
  );
  res.cookies.set({
    name: GUEST_COOKIE_NAME,
    value: result.party.sessionToken,
    ...guestCookieAttrs(GUEST_COOKIE_MAX_AGE),
  });
  if (result.phoneSeenBefore) {
    res.cookies.set({
      name: WELCOME_BACK_COOKIE,
      value: "1",
      httpOnly: false,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: WELCOME_BACK_MAX_AGE,
    });
  }
  return res;
}
