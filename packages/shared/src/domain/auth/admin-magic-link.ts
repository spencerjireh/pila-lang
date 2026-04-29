import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { users, verificationTokens } from "@pila/db/schema";

import { env } from "../../primitives/config/env";

const TOKEN_BYTES = 32;
const TOKEN_TTL_SECONDS = 15 * 60;

/**
 * HMAC the plaintext token with NEXTAUTH_SECRET so the DB-side
 * `verification_token.token` column is never the live secret. A leaked DB
 * snapshot can't be replayed because the attacker can't reverse the HMAC
 * back to the plaintext that the URL carries.
 */
function hashToken(plaintext: string): string {
  return createHmac("sha256", env().NEXTAUTH_SECRET)
    .update(plaintext)
    .digest("hex");
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export interface IssueMagicLinkResult {
  identifier: string;
  url: string;
}

/**
 * Insert a new magic-link verification row and return the public URL.
 *
 * The plaintext token is HMAC-hashed for DB storage. The plaintext is only
 * embedded in the returned URL — the caller is responsible for delivering
 * that URL via a side channel the user controls (email).
 */
export async function issueMagicLink(params: {
  email: string;
  baseUrl: string;
}): Promise<IssueMagicLinkResult> {
  const identifier = params.email.trim().toLowerCase();
  const plaintext = randomBytes(TOKEN_BYTES).toString("base64url");
  const hashed = hashToken(plaintext);
  const expires = new Date(Date.now() + TOKEN_TTL_SECONDS * 1000);

  await getDb()
    .insert(verificationTokens)
    .values({ identifier, token: hashed, expires });

  const callbackUrl = new URL("/api/v1/auth/callback", params.baseUrl);
  callbackUrl.searchParams.set("token", plaintext);
  callbackUrl.searchParams.set("email", identifier);

  return { identifier, url: callbackUrl.toString() };
}

export type ConsumeMagicLinkResult =
  | { ok: true; userId: string; email: string }
  | { ok: false; reason: "invalid_token" | "expired" };

/**
 * Look up a magic-link by (email, hashed token), enforce single-use via
 * row delete in the same transaction, and upsert the user row. Returns the
 * resolved user id on success.
 *
 * Uses constant-time comparison and a transaction-scoped delete so a
 * concurrent second request can't redeem the same token.
 */
export async function consumeMagicLink(params: {
  email: string;
  token: string;
}): Promise<ConsumeMagicLinkResult> {
  const identifier = params.email.trim().toLowerCase();
  const hashed = hashToken(params.token);
  const db = getDb();

  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, hashed),
        ),
      )
      .limit(1);

    const row = rows[0];
    if (!row || !constantTimeEqual(row.token, hashed)) {
      return { ok: false, reason: "invalid_token" };
    }

    // Single-use: delete first so a concurrent request finds nothing.
    await tx
      .delete(verificationTokens)
      .where(
        and(
          eq(verificationTokens.identifier, identifier),
          eq(verificationTokens.token, hashed),
        ),
      );

    if (row.expires.getTime() <= Date.now()) {
      return { ok: false, reason: "expired" };
    }

    const existing = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, identifier))
      .limit(1);

    let userId: string;
    if (existing[0]) {
      userId = existing[0].id;
      await tx
        .update(users)
        .set({ emailVerified: new Date() })
        .where(eq(users.id, userId));
    } else {
      const inserted = await tx
        .insert(users)
        .values({ email: identifier, emailVerified: new Date() })
        .returning({ id: users.id });
      userId = inserted[0]!.id;
    }

    return { ok: true, userId, email: identifier };
  });
}
