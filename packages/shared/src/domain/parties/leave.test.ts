import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { parties } from "@pila/db/schema";
import { tenantDb } from "@pila/db/tenant-scoped";
import { classifyLeave, leavePublishPlan } from "./leave";

const TENANT = "00000000-0000-0000-0000-000000000001";

describe("classifyLeave", () => {
  it("returns not_found when the party row is null or undefined", () => {
    expect(classifyLeave(null)).toBe("not_found");
    expect(classifyLeave(undefined)).toBe("not_found");
  });

  it("returns conflict for any terminal status", () => {
    expect(classifyLeave({ status: "seated" })).toBe("conflict");
    expect(classifyLeave({ status: "no_show" })).toBe("conflict");
    expect(classifyLeave({ status: "left" })).toBe("conflict");
  });

  it("returns ok only for waiting parties", () => {
    expect(classifyLeave({ status: "waiting" })).toBe("ok");
  });
});

describe("leavePublishPlan", () => {
  const args = {
    partyId: "party-xyz",
    slug: "demo",
    resolvedAt: "2026-04-19T12:00:00.000Z",
  } as const;

  it("emits status_changed on party:<id> first, then party:left on tenant:<slug>:queue", () => {
    const plan = leavePublishPlan(args);
    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({
      channel: "party:party-xyz",
      event: {
        type: "status_changed",
        status: "left",
        resolvedAt: args.resolvedAt,
      },
    });
    expect(plan[1]).toEqual({
      channel: "tenant:demo:queue",
      event: {
        type: "party:left",
        id: "party-xyz",
        status: "left",
        resolvedAt: args.resolvedAt,
      },
    });
  });

  it("order is load-bearing: party channel publishes before tenant channel", () => {
    const [first, second] = leavePublishPlan(args);
    expect(first!.channel.startsWith("party:")).toBe(true);
    expect(second!.channel.startsWith("tenant:")).toBe(true);
  });
});

describe("leaveQueue update query shape", () => {
  it("filters the UPDATE on tenant_id, party id, and status='waiting' so a concurrent seat can't be overwritten", () => {
    const partyId = "00000000-0000-0000-0000-0000000000aa";
    const q = tenantDb(TENANT).parties.update(
      { status: "left", resolvedAt: new Date("2026-04-19T12:00:00.000Z") },
      and(eq(parties.id, partyId), eq(parties.status, "waiting")),
    );
    const { sql, params } = q.toSQL();
    expect(sql).toMatch(/"parties"\."tenant_id" = \$/);
    expect(sql).toMatch(/"parties"\."id" = \$/);
    expect(sql).toMatch(/"parties"\."status" = \$/);
    expect(params).toContain(TENANT);
    expect(params).toContain(partyId);
    expect(params).toContain("waiting");
    expect(params).toContain("left");
  });
});
