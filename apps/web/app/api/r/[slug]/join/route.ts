import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  GUEST_COOKIE_MAX_AGE,
  GUEST_COOKIE_NAME,
  guestCookieAttrs,
} from "@pila/shared/domain/auth/guest-session";
import { clientIp } from "@pila/shared/infra/http/client-ip";
import { errorResponse } from "@pila/shared/infra/http/error-response";
import { parseJsonBody } from "@pila/shared/infra/http/parse-json-body";
import { log } from "@pila/shared/infra/log/logger";
import { joinQueue } from "@pila/shared/domain/parties/join";
import { verifyQrToken } from "@pila/shared/primitives/qr/token";
import { enforceRateLimit } from "@pila/shared/infra/ratelimit/enforce";

const WELCOME_BACK_COOKIE = "welcome_back";
const WELCOME_BACK_MAX_AGE = 5 * 60;

const joinSchema = z.object({
  name: z.string().trim().min(1, "name_required").max(80),
  partySize: z.number().int().min(1).max(20),
  phone: z
    .union([
      z
        .string()
        .trim()
        .regex(/^\+[1-9]\d{5,14}$/u, "bad_phone"),
      z.literal(""),
      z.null(),
      z.undefined(),
    ])
    .transform((v) => (v && v !== "" ? v : null)),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { slug: string } },
) {
  const token = req.nextUrl.searchParams.get("t");
  if (!token) return errorResponse(401, "missing_token");
  const verdict = verifyQrToken(params.slug, token);
  if (!verdict.ok) {
    return errorResponse(401, "invalid_token", { reason: verdict.reason });
  }

  const parsed = await parseJsonBody(req, joinSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;

  const limited = await enforceRateLimit([
    input.phone
      ? { bucket: "joinPerPhone", key: input.phone }
      : { bucket: "joinPerIp", key: clientIp(req.headers) },
    { bucket: "joinGlobalPerTenant", key: params.slug },
  ]);
  if (limited) return limited;

  let result;
  try {
    result = await joinQueue(params.slug, {
      name: input.name,
      partySize: input.partySize,
      phone: input.phone,
    });
  } catch (err) {
    log.error("join.failed", { slug: params.slug, err: String(err) });
    return errorResponse(500, "internal");
  }

  if (!result.ok) {
    const status = result.reason === "not_found" ? 404 : 409;
    return errorResponse(status, result.reason);
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
