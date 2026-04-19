import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db/client";
import { parties, pushTokens, tenants } from "@/lib/db/schema";

import {
  listActivePushTokensForParty,
  registerPushToken,
  unregisterPushToken,
} from "./registry";

async function dbReachable(): Promise<boolean> {
  try {
    await getDb().execute("SELECT 1" as never);
    return true;
  } catch {
    return false;
  }
}

let canConnect = false;

async function makeTenant(): Promise<string> {
  const slug = `t-${randomUUID().slice(0, 8)}`;
  const [row] = await getDb()
    .insert(tenants)
    .values({
      slug,
      name: slug,
      hostPasswordHash: "x",
      timezone: "UTC",
    })
    .returning({ id: tenants.id });
  if (!row) throw new Error("tenant insert failed");
  return row.id;
}

async function makeParty(tenantId: string): Promise<string> {
  const [row] = await getDb()
    .insert(parties)
    .values({
      tenantId,
      name: "Test",
      partySize: 2,
      status: "waiting",
      sessionToken: randomUUID(),
    })
    .returning({ id: parties.id });
  if (!row) throw new Error("party insert failed");
  return row.id;
}

async function cleanup(tenantId: string) {
  await getDb().delete(pushTokens).where(eq(pushTokens.tenantId, tenantId));
  await getDb().delete(parties).where(eq(parties.tenantId, tenantId));
  await getDb().delete(tenants).where(eq(tenants.id, tenantId));
}

beforeAll(async () => {
  canConnect = await dbReachable();
});

describe.skipIf(!process.env.DATABASE_URL?.includes("@"))(
  "push registry",
  () => {
    let tenantId: string;
    let partyId: string;

    beforeEach(async (ctx) => {
      if (!canConnect) ctx.skip();
      tenantId = await makeTenant();
      partyId = await makeParty(tenantId);
    });

    it("registers a token and lists it back", async () => {
      const row = await registerPushToken({
        tenantId,
        scope: "guest_party",
        scopeId: partyId,
        platform: "ios",
        deviceToken: "devtok-1",
      });
      expect(row.tenantId).toBe(tenantId);
      expect(row.revokedAt).toBeNull();

      const live = await listActivePushTokensForParty(partyId);
      expect(live).toHaveLength(1);
      expect(live[0]?.deviceToken).toBe("devtok-1");

      await cleanup(tenantId);
    });

    it("is idempotent for identical (scope_id, device_token)", async () => {
      const a = await registerPushToken({
        tenantId,
        scope: "guest_party",
        scopeId: partyId,
        platform: "ios",
        deviceToken: "devtok-2",
      });
      const b = await registerPushToken({
        tenantId,
        scope: "guest_party",
        scopeId: partyId,
        platform: "ios",
        deviceToken: "devtok-2",
      });
      expect(b.id).toBe(a.id);

      const live = await listActivePushTokensForParty(partyId);
      expect(live).toHaveLength(1);

      await cleanup(tenantId);
    });

    it("re-registers after unregister without unique-index conflict", async () => {
      await registerPushToken({
        tenantId,
        scope: "guest_party",
        scopeId: partyId,
        platform: "android",
        deviceToken: "devtok-3",
      });
      const revokeResult = await unregisterPushToken({
        scopeId: partyId,
        deviceToken: "devtok-3",
      });
      expect(revokeResult.revoked).toBe(true);

      const reregistered = await registerPushToken({
        tenantId,
        scope: "guest_party",
        scopeId: partyId,
        platform: "android",
        deviceToken: "devtok-3",
      });
      expect(reregistered.revokedAt).toBeNull();

      const live = await listActivePushTokensForParty(partyId);
      expect(live).toHaveLength(1);
      expect(live[0]?.id).toBe(reregistered.id);

      const total = await getDb()
        .select()
        .from(pushTokens)
        .where(
          and(
            eq(pushTokens.scopeId, partyId),
            eq(pushTokens.deviceToken, "devtok-3"),
          ),
        );
      expect(total).toHaveLength(2);

      await cleanup(tenantId);
    });

    it("unregister on unknown token returns { revoked: false }", async () => {
      const result = await unregisterPushToken({
        scopeId: partyId,
        deviceToken: "never-registered",
      });
      expect(result.revoked).toBe(false);
      await cleanup(tenantId);
    });
  },
);
