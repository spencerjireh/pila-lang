import { describe, expect, it } from "vitest";

import type { Party } from "@/lib/db/schema";

import { hostActionPublishPlan, undoPublishPlan } from "./host-actions";

const RESOLVED_AT = "2026-04-19T12:00:00.000Z";

describe("hostActionPublishPlan", () => {
  it("publishes tenant channel first, then party channel (seat)", () => {
    const plan = hostActionPublishPlan({
      slug: "demo",
      partyId: "p1",
      action: "seat",
      resolvedAt: RESOLVED_AT,
    });
    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({
      channel: "tenant:demo:queue",
      event: {
        type: "party:seated",
        id: "p1",
        status: "seated",
        resolvedAt: RESOLVED_AT,
      },
    });
    expect(plan[1]).toEqual({
      channel: "party:p1",
      event: {
        type: "status_changed",
        status: "seated",
        resolvedAt: RESOLVED_AT,
      },
    });
  });

  it("publishes party:removed and no_show for remove", () => {
    const plan = hostActionPublishPlan({
      slug: "demo",
      partyId: "p1",
      action: "remove",
      resolvedAt: RESOLVED_AT,
    });
    expect((plan[0] as { event: { type: string; status: string } }).event.type).toBe(
      "party:removed",
    );
    expect((plan[0] as { event: { status: string } }).event.status).toBe("no_show");
    expect((plan[1] as { event: { status: string } }).event.status).toBe("no_show");
  });

  it("order is load-bearing: tenant channel publishes before party channel", () => {
    const plan = hostActionPublishPlan({
      slug: "demo",
      partyId: "p1",
      action: "seat",
      resolvedAt: RESOLVED_AT,
    });
    expect(plan[0]!.channel.startsWith("tenant:")).toBe(true);
    expect(plan[1]!.channel.startsWith("party:")).toBe(true);
  });
});

describe("undoPublishPlan", () => {
  const party: Party = {
    id: "p9",
    tenantId: "tenant-1",
    name: "Priya",
    phone: "+14155550100",
    partySize: 2,
    status: "waiting",
    sessionToken: "tok",
    joinedAt: new Date("2026-04-19T11:00:00.000Z"),
    seatedAt: null,
    resolvedAt: null,
  };

  it("publishes status_changed on party channel first, then party:restored on tenant channel", () => {
    const plan = undoPublishPlan({ slug: "demo", party });
    expect(plan).toHaveLength(2);
    expect(plan[0]).toEqual({
      channel: "party:p9",
      event: { type: "status_changed", status: "waiting" },
    });
    expect(plan[1]).toEqual({
      channel: "tenant:demo:queue",
      event: {
        type: "party:restored",
        id: "p9",
        name: "Priya",
        partySize: 2,
        phone: "+14155550100",
        joinedAt: "2026-04-19T11:00:00.000Z",
      },
    });
  });
});
