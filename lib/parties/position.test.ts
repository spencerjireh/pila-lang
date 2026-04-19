import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { parties } from "@pila/db/schema";
import { tenantDb } from "@pila/db/tenant-scoped";

import { positionEventsFor, rankOf } from "./position";

const TENANT = "00000000-0000-0000-0000-000000000001";

describe("listWaitingIdsInOrder query shape", () => {
  it("filters tenant_id + status='waiting' ordered by joined_at ASC", () => {
    const q = tenantDb(TENANT)
      .parties.select(eq(parties.status, "waiting"))
      .orderBy(asc(parties.joinedAt));
    const { sql, params } = q.toSQL();
    expect(sql).toMatch(/"parties"\."tenant_id" = \$/);
    expect(sql).toMatch(/"parties"\."status" = \$/);
    expect(sql).toMatch(/order by "parties"\."joined_at" asc/i);
    expect(params).toContain(TENANT);
    expect(params).toContain("waiting");
  });
});

describe("rankOf", () => {
  it("returns 1 for the earliest-joined waiting party", () => {
    expect(rankOf(["p1", "p2", "p3"], "p1")).toBe(1);
  });

  it("returns N for the last waiting party", () => {
    expect(rankOf(["p1", "p2", "p3"], "p3")).toBe(3);
  });

  it("returns 0 when the target is not in the waiting list", () => {
    expect(rankOf(["p1", "p2"], "resolved-id")).toBe(0);
  });

  it("returns 0 for an empty list", () => {
    expect(rankOf([], "anything")).toBe(0);
  });
});

describe("positionEventsFor", () => {
  it("emits one position_changed event per id in list order", () => {
    expect(positionEventsFor(["a", "b", "c"])).toEqual([
      { channel: "party:a", event: { type: "position_changed", position: 1 } },
      { channel: "party:b", event: { type: "position_changed", position: 2 } },
      { channel: "party:c", event: { type: "position_changed", position: 3 } },
    ]);
  });

  it("emits nothing for an empty list", () => {
    expect(positionEventsFor([])).toEqual([]);
  });
});
