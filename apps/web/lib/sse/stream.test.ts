import { describe, expect, it, vi } from "vitest";

import { resolvedPartyShortCircuit, sseStream } from "./stream";

const DECODER = new TextDecoder();

async function readOne(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<string> {
  const { value, done } = await reader.read();
  if (done || !value) return "";
  return DECODER.decode(value);
}

describe("sseStream", () => {
  it("runs onSubscribe before snapshot and emits snapshot as the first SSE event", async () => {
    const order: string[] = [];
    const res = sseStream({
      onSubscribe: async () => {
        order.push("subscribe");
      },
      snapshot: async () => {
        order.push("snapshot");
        return { data: { type: "snapshot", value: 42 } };
      },
    });
    const reader = res.body!.getReader();
    const first = await readOne(reader);
    expect(order).toEqual(["subscribe", "snapshot"]);
    expect(first).toContain(
      `data: ${JSON.stringify({ type: "snapshot", value: 42 })}`,
    );
    await reader.cancel();
  });

  it("buffers events published during snapshot read and drains them after", async () => {
    const res = sseStream({
      onSubscribe: (handle) => {
        handle.send({ data: { type: "buffered", n: 1 } });
        handle.send({ data: { type: "buffered", n: 2 } });
      },
      snapshot: () => ({ data: { type: "snapshot" } }),
    });
    const reader = res.body!.getReader();
    const chunk1 = await readOne(reader);
    expect(chunk1).toContain(`"type":"snapshot"`);
    const chunk2 = await readOne(reader);
    expect(chunk2).toContain(`"type":"buffered","n":1`);
    const chunk3 = await readOne(reader);
    expect(chunk3).toContain(`"type":"buffered","n":2`);
    await reader.cancel();
  });

  it("merges extraHeaders into the Response (e.g. Set-Cookie refresh)", () => {
    const res = sseStream({
      onSubscribe: () => {},
      snapshot: () => ({ data: {} }),
      extraHeaders: {
        "Set-Cookie": "party_session=abc; Max-Age=86400; HttpOnly",
      },
    });
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    expect(res.headers.get("cache-control")).toMatch(/no-cache/);
    expect(res.headers.get("set-cookie")).toContain("party_session=abc");
  });

  it("installs a 15-second heartbeat interval", async () => {
    const setSpy = vi.spyOn(globalThis, "setInterval");
    const res = sseStream({
      onSubscribe: () => {},
      snapshot: () => ({ data: {} }),
    });
    const reader = res.body!.getReader();
    await readOne(reader);
    expect(setSpy).toHaveBeenCalledWith(expect.any(Function), 15_000);
    await reader.cancel();
    setSpy.mockRestore();
  });

  it("resolvedPartyShortCircuit returns 204", () => {
    expect(resolvedPartyShortCircuit().status).toBe(204);
  });
});
