import { describe, expect, it, vi } from "vitest";

import type { Party, PushToken } from "@pila/db/schema";

import type { SendOutcome } from "./firebase";
import { PushNotifier, type PushNotifierDeps } from "./push-notifier";

const PARTY: Party = {
  id: "00000000-0000-0000-0000-000000000001",
  tenantId: "00000000-0000-0000-0000-000000000002",
  name: "Alice",
  phone: null,
  partySize: 2,
  status: "seated",
  sessionToken: "tok",
  joinedAt: new Date("2026-04-19T12:00:00Z"),
  seatedAt: new Date("2026-04-19T12:30:00Z"),
  resolvedAt: new Date("2026-04-19T12:30:00Z"),
};

function token(overrides: Partial<PushToken> = {}): PushToken {
  return {
    id: overrides.id ?? "token-" + Math.random().toString(36).slice(2, 10),
    tenantId: PARTY.tenantId,
    scope: "guest_party",
    scopeId: PARTY.id,
    platform: "ios",
    deviceToken: "devtok",
    createdAt: new Date(),
    revokedAt: null,
    ...overrides,
  } as PushToken;
}

function makeDeps(
  overrides: Partial<PushNotifierDeps> = {},
): PushNotifierDeps & {
  records: Array<{ partyId: string; status: string; payload: unknown }>;
} {
  const records: Array<{ partyId: string; status: string; payload: unknown }> =
    [];
  return {
    listTokens: overrides.listTokens ?? vi.fn(async () => []),
    send:
      overrides.send ??
      vi.fn(async () => ({ ok: false, reason: "disabled" }) as SendOutcome),
    revoke: overrides.revoke ?? vi.fn(async () => {}),
    recordNotification:
      overrides.recordNotification ??
      (async (r) => {
        records.push(r);
      }),
    records,
  };
}

describe("PushNotifier.onPartyReady", () => {
  it("records 'skipped' when no tokens exist", async () => {
    const deps = makeDeps();
    await new PushNotifier(deps).onPartyReady(PARTY);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.records).toHaveLength(1);
    expect(deps.records[0]).toMatchObject({
      status: "skipped",
      payload: { reason: "no_tokens" },
    });
  });

  it("dispatches to every live token and records 'sent' per success", async () => {
    const deps = makeDeps({
      listTokens: vi.fn(async () => [token({ id: "a" }), token({ id: "b" })]),
      send: vi.fn(async () => ({ ok: true, messageId: "msg" }) as SendOutcome),
    });
    await new PushNotifier(deps).onPartyReady(PARTY);
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.records).toHaveLength(2);
    for (const r of deps.records) expect(r.status).toBe("sent");
  });

  it("records 'failed' for transport errors without revoking", async () => {
    const deps = makeDeps({
      listTokens: vi.fn(async () => [token({ id: "x" })]),
      send: vi.fn(
        async () =>
          ({
            ok: false,
            reason: "transport",
            detail: "network",
          }) as SendOutcome,
      ),
    });
    await new PushNotifier(deps).onPartyReady(PARTY);
    expect(deps.revoke).not.toHaveBeenCalled();
    expect(deps.records[0]?.status).toBe("failed");
  });

  it("revokes and records 'token_revoked' for invalid-token errors", async () => {
    const deps = makeDeps({
      listTokens: vi.fn(async () => [token({ id: "gone" })]),
      send: vi.fn(
        async () =>
          ({
            ok: false,
            reason: "invalid_token",
            detail: "unregistered",
          }) as SendOutcome,
      ),
    });
    await new PushNotifier(deps).onPartyReady(PARTY);
    expect(deps.revoke).toHaveBeenCalledWith("gone");
    expect(deps.records[0]?.status).toBe("token_revoked");
  });

  it("swallows listTokens failure silently", async () => {
    const deps = makeDeps({
      listTokens: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    await expect(
      new PushNotifier(deps).onPartyReady(PARTY),
    ).resolves.not.toThrow();
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.records).toHaveLength(0);
  });

  it("does not call send on onPartyJoined (v1.5 scope)", async () => {
    const deps = makeDeps({
      listTokens: vi.fn(async () => [token()]),
    });
    await new PushNotifier(deps).onPartyJoined(PARTY);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.records).toHaveLength(0);
  });
});
