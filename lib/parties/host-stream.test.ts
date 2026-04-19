import { describe, expect, it } from "vitest";

import type { Party } from "@/lib/db/schema";

import {
  buildHostSnapshot,
  HOST_RECENTLY_RESOLVED_WINDOW_MS,
  HOST_RESOLVED_STATUSES,
  isResolvedRow,
  toRecentlyResolvedRow,
  toWaitingRow,
} from "./host-stream";

const tenant = {
  slug: "demo",
  name: "Demo",
  isOpen: true,
  logoUrl: null,
  accentColor: "#1F6FEB",
};

function partyRow(overrides: Partial<Party>): Party {
  return {
    id: "p",
    tenantId: "t",
    name: "Priya",
    phone: null,
    partySize: 2,
    status: "waiting",
    sessionToken: "tok",
    joinedAt: new Date("2026-04-19T11:00:00.000Z"),
    seatedAt: null,
    resolvedAt: null,
    ...overrides,
  };
}

describe("toWaitingRow", () => {
  it("serializes joinedAt as ISO and keeps scalar fields", () => {
    const row = toWaitingRow(
      partyRow({ id: "p1", phone: "+14155550100", partySize: 3 }),
    );
    expect(row).toEqual({
      id: "p1",
      name: "Priya",
      partySize: 3,
      phone: "+14155550100",
      joinedAt: "2026-04-19T11:00:00.000Z",
    });
  });
});

describe("toRecentlyResolvedRow", () => {
  it("uses resolvedAt when present", () => {
    const row = toRecentlyResolvedRow(
      partyRow({
        id: "p2",
        status: "seated",
        resolvedAt: new Date("2026-04-19T11:20:00.000Z"),
      }),
    );
    expect(row).toEqual({
      id: "p2",
      name: "Priya",
      partySize: 2,
      status: "seated",
      resolvedAt: "2026-04-19T11:20:00.000Z",
    });
  });

  it("falls back to joinedAt if resolvedAt is null", () => {
    const row = toRecentlyResolvedRow(
      partyRow({
        id: "p3",
        status: "no_show",
        resolvedAt: null,
      }),
    );
    expect(row.resolvedAt).toBe("2026-04-19T11:00:00.000Z");
  });
});

describe("buildHostSnapshot", () => {
  it("packages tenant, waiting, and recently resolved into a single event", () => {
    const waiting = [toWaitingRow(partyRow({ id: "w1" }))];
    const resolved = [
      toRecentlyResolvedRow(
        partyRow({
          id: "r1",
          status: "seated",
          resolvedAt: new Date("2026-04-19T11:10:00.000Z"),
        }),
      ),
    ];
    const snap = buildHostSnapshot(tenant, waiting, resolved);
    expect(snap.type).toBe("snapshot");
    expect(snap.tenant).toEqual(tenant);
    expect(snap.waiting).toEqual(waiting);
    expect(snap.recentlyResolved).toEqual(resolved);
  });
});

describe("isResolvedRow", () => {
  const now = new Date("2026-04-19T12:00:00.000Z");

  it("is false for a waiting row", () => {
    expect(
      isResolvedRow({ status: "waiting", resolvedAt: null }, now),
    ).toBe(false);
  });

  it("is false for a terminal row with no resolvedAt", () => {
    expect(
      isResolvedRow({ status: "seated", resolvedAt: null }, now),
    ).toBe(false);
  });

  it("is true for a terminal row resolved within the 30-minute window", () => {
    expect(
      isResolvedRow(
        {
          status: "left",
          resolvedAt: new Date(now.getTime() - 5 * 60 * 1000),
        },
        now,
      ),
    ).toBe(true);
  });

  it("is false for a terminal row resolved past the 30-minute window", () => {
    expect(
      isResolvedRow(
        {
          status: "no_show",
          resolvedAt: new Date(now.getTime() - HOST_RECENTLY_RESOLVED_WINDOW_MS - 1),
        },
        now,
      ),
    ).toBe(false);
  });

  it("covers every terminal status", () => {
    expect([...HOST_RESOLVED_STATUSES].sort()).toEqual(["left", "no_show", "seated"]);
  });
});
