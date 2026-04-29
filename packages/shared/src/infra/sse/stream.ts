/**
 * Express-shaped SSE primitive. Mirrors the previous Web-Streams implementation
 * (apps/web/lib/sse/stream.ts) but writes directly to a node http response.
 *
 * Invariants preserved (see docs/Technical-Spec.md):
 *   1. subscribe BEFORE snapshot — events that fire during the snapshot read
 *      are buffered and flushed AFTER the snapshot, so nothing is dropped in
 *      the gap.
 *   2. heartbeat (`:ping`) every HEARTBEAT_INTERVAL_MS so proxies don't reap
 *      idle connections.
 *   3. cleanup on client disconnect (`res.on('close')`) calls `onClose`.
 *   4. Headers include `X-Accel-Buffering: no` and `Cache-Control: no-cache,
 *      no-transform` so reverse proxies don't buffer or transform the stream.
 */

/**
 * Minimal structural types covering what the SSE primitive needs from an
 * Express-shaped req/res. Stops `packages/shared` from depending on the
 * `express` types package — apps/api and any future runtime can pass their
 * actual req/res, structural compatibility checked by TS at the call site.
 */
export interface SseRequestLike {
  on(event: "close", listener: () => void): unknown;
}

export interface SseResponseLike {
  setHeader(name: string, value: string): unknown;
  flushHeaders?(): void;
  write(chunk: string): unknown;
  end(): unknown;
  on(event: "close", listener: () => void): unknown;
  status(code: number): SseResponseLike;
}

const HEARTBEAT_INTERVAL_MS = 15_000;

export type SseEvent = {
  event?: string;
  data: unknown;
  id?: string;
};

export interface SseHandle {
  send(event: SseEvent): void;
  close(finalEvent?: SseEvent): void;
  readonly signal: AbortSignal;
}

export interface SseStreamOptions {
  /** Wire subscriptions BEFORE snapshot reads — buffered events flush after. */
  onSubscribe: (handle: SseHandle) => Promise<void> | void;
  /** Read initial state AFTER subscriptions are active. Sent as the first event. */
  snapshot: (handle: SseHandle) => Promise<SseEvent> | SseEvent;
  /** Tear down subscriptions and any resources. */
  onClose?: (handle: SseHandle) => Promise<void> | void;
  /** Headers (e.g., refreshed Set-Cookie or X-Refreshed-Token) set BEFORE flushHeaders. */
  extraHeaders?: Record<string, string>;
}

function formatSse(event: SseEvent): string {
  let out = "";
  if (event.id) out += `id: ${event.id}\n`;
  if (event.event) out += `event: ${event.event}\n`;
  out += `data: ${JSON.stringify(event.data)}\n\n`;
  return out;
}

/**
 * Start an SSE response. Returns the handle so callers (e.g., a shutdown
 * registry) can broadcast a terminal event and close the stream remotely.
 *
 * The registry's `register/unregister` is wired by the caller — this primitive
 * stays runtime-agnostic and doesn't import app-level singletons.
 */
export async function startSseStream(
  req: SseRequestLike,
  res: SseResponseLike,
  options: SseStreamOptions,
): Promise<SseHandle> {
  const abort = new AbortController();
  let bufferedBeforeSnapshot: SseEvent[] | null = [];
  let heartbeat: NodeJS.Timeout | undefined;
  let closed = false;

  for (const [k, v] of Object.entries(options.extraHeaders ?? {})) {
    res.setHeader(k, v);
  }
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  function safeWrite(chunk: string): void {
    if (closed) return;
    try {
      res.write(chunk);
    } catch {
      // Socket already closed (client disconnected mid-write).
    }
  }

  const handle: SseHandle = {
    signal: abort.signal,
    send(event) {
      if (closed) return;
      if (bufferedBeforeSnapshot) {
        bufferedBeforeSnapshot.push(event);
        return;
      }
      safeWrite(formatSse(event));
    },
    close(finalEvent) {
      if (closed) return;
      closed = true;
      if (finalEvent) safeWrite(formatSse(finalEvent));
      abort.abort();
      if (heartbeat) clearInterval(heartbeat);
      try {
        res.end();
      } catch {
        // already ended
      }
      void options.onClose?.(handle);
    },
  };

  req.on("close", () => {
    if (closed) return;
    closed = true;
    abort.abort();
    if (heartbeat) clearInterval(heartbeat);
    void options.onClose?.(handle);
  });
  res.on("close", () => {
    if (closed) return;
    closed = true;
    abort.abort();
    if (heartbeat) clearInterval(heartbeat);
    void options.onClose?.(handle);
  });

  heartbeat = setInterval(() => {
    if (closed) return;
    safeWrite(":ping\n\n");
  }, HEARTBEAT_INTERVAL_MS);

  try {
    await options.onSubscribe(handle);
    const snap = await options.snapshot(handle);
    safeWrite(formatSse(snap));
    const buffered = bufferedBeforeSnapshot ?? [];
    bufferedBeforeSnapshot = null;
    for (const ev of buffered) safeWrite(formatSse(ev));
  } catch (err) {
    safeWrite(
      formatSse({
        event: "error",
        data: { message: err instanceof Error ? err.message : "stream failed" },
      }),
    );
    handle.close();
  }

  return handle;
}

/** 204 reply for reconnects to a terminal/non-existent party — stops EventSource retries. */
export function resolvedPartyShortCircuit(res: SseResponseLike): void {
  res.status(204).end();
}
