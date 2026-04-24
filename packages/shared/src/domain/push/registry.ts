import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import {
  pushTokens,
  type PushPlatform,
  type PushScope,
  type PushToken,
} from "@pila/db/schema";

export interface RegisterInput {
  tenantId: string;
  scope: PushScope;
  scopeId: string;
  platform: PushPlatform;
  deviceToken: string;
}

export async function registerPushToken(
  input: RegisterInput,
): Promise<PushToken> {
  const db = getDb();
  const [existing] = await db
    .select()
    .from(pushTokens)
    .where(
      and(
        eq(pushTokens.scopeId, input.scopeId),
        eq(pushTokens.deviceToken, input.deviceToken),
        isNull(pushTokens.revokedAt),
      ),
    );
  if (existing) return existing;

  const [row] = await db
    .insert(pushTokens)
    .values({
      tenantId: input.tenantId,
      scope: input.scope,
      scopeId: input.scopeId,
      platform: input.platform,
      deviceToken: input.deviceToken,
    })
    .returning();
  if (!row) throw new Error("push_token insert returned no row");
  return row;
}

export async function unregisterPushToken(input: {
  scopeId: string;
  deviceToken: string;
}): Promise<{ revoked: boolean }> {
  const db = getDb();
  const result = await db
    .update(pushTokens)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(pushTokens.scopeId, input.scopeId),
        eq(pushTokens.deviceToken, input.deviceToken),
        isNull(pushTokens.revokedAt),
      ),
    )
    .returning({ id: pushTokens.id });
  return { revoked: result.length > 0 };
}

export async function listActivePushTokensForParty(
  partyId: string,
): Promise<PushToken[]> {
  const db = getDb();
  return db
    .select()
    .from(pushTokens)
    .where(
      and(
        eq(pushTokens.scope, "guest_party"),
        eq(pushTokens.scopeId, partyId),
        isNull(pushTokens.revokedAt),
      ),
    );
}

export async function revokePushTokenById(id: string): Promise<void> {
  await getDb()
    .update(pushTokens)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(pushTokens.id, id), isNull(pushTokens.revokedAt)));
}
