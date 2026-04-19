import { describe, expect, it } from "vitest";

import {
  isWithinUndoWindow,
  parseFrame,
  undoKey,
  UNDO_WINDOW_MS,
  type UndoFrame,
} from "./undo-store";

const FRAME: UndoFrame = {
  action: "seat",
  partyId: "p1",
  previousStatus: "waiting",
  timestamp: 1_000_000,
};

describe("undoKey", () => {
  it("namespaces by tenant id", () => {
    expect(undoKey("tenant-abc")).toBe("undo:tenant:tenant-abc");
  });
});

describe("parseFrame", () => {
  it("accepts a well-formed seat frame", () => {
    expect(parseFrame(JSON.stringify(FRAME))).toEqual(FRAME);
  });

  it("accepts a well-formed remove frame", () => {
    const f = { ...FRAME, action: "remove" as const };
    expect(parseFrame(JSON.stringify(f))).toEqual(f);
  });

  it("rejects null/empty payloads", () => {
    expect(parseFrame(null)).toBeNull();
    expect(parseFrame(undefined)).toBeNull();
    expect(parseFrame("")).toBeNull();
  });

  it("rejects malformed JSON", () => {
    expect(parseFrame("{not json")).toBeNull();
  });

  it("rejects an unknown action", () => {
    expect(
      parseFrame(JSON.stringify({ ...FRAME, action: "delete" })),
    ).toBeNull();
  });

  it("rejects a non-waiting previousStatus", () => {
    expect(
      parseFrame(JSON.stringify({ ...FRAME, previousStatus: "seated" })),
    ).toBeNull();
  });

  it("rejects a missing partyId", () => {
    expect(parseFrame(JSON.stringify({ ...FRAME, partyId: "" }))).toBeNull();
  });

  it("rejects a non-numeric timestamp", () => {
    expect(
      parseFrame(JSON.stringify({ ...FRAME, timestamp: "nope" })),
    ).toBeNull();
  });
});

describe("undo race resolution (LPOP is atomic)", () => {
  // Simulates the shape of the handler's decision path. The backing list
  // (Redis LPOP) returns the single frame to exactly one caller; the loser
  // sees null. Both callers must resolve cleanly.
  function simulateTwoCallers(frame: UndoFrame | null) {
    const queue = frame ? [JSON.stringify(frame)] : [];
    const pop = (): UndoFrame | null => parseFrame(queue.shift() ?? null);
    const a = pop();
    const b = pop();
    return { a, b };
  }

  it("exactly one caller gets the frame when one is present", () => {
    const { a, b } = simulateTwoCallers(FRAME);
    const winners = [a, b].filter(Boolean);
    const losers = [a, b].filter((x) => x === null);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
  });

  it("both callers get null when the stack is empty", () => {
    const { a, b } = simulateTwoCallers(null);
    expect(a).toBeNull();
    expect(b).toBeNull();
  });
});

describe("isWithinUndoWindow", () => {
  it("accepts a frame within the 60s window", () => {
    const now = FRAME.timestamp + 30_000;
    expect(isWithinUndoWindow(FRAME, now)).toBe(true);
  });

  it("accepts a frame exactly at the window edge", () => {
    const now = FRAME.timestamp + UNDO_WINDOW_MS;
    expect(isWithinUndoWindow(FRAME, now)).toBe(true);
  });

  it("rejects a frame outside the 60s window", () => {
    const now = FRAME.timestamp + UNDO_WINDOW_MS + 1;
    expect(isWithinUndoWindow(FRAME, now)).toBe(false);
  });
});
