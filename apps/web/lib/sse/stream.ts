const ENCODER = new TextEncoder();
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
  /** Called BEFORE snapshot; must complete subscriptions (so events are buffered during snapshot read). */
  onSubscribe: (handle: SseHandle) => Promise<void> | void;
  /** Reads initial state AFTER subscriptions are active, returned as the first SSE event. */
  snapshot: (handle: SseHandle) => Promise<SseEvent> | SseEvent;
  /** Called when the client disconnects; use to tear down subscriptions. */
  onClose?: (handle: SseHandle) => Promise<void> | void;
  /** Extra response headers merged on top of the SSE defaults (e.g. Set-Cookie). */
  extraHeaders?: Record<string, string>;
}

function formatSse(event: SseEvent): Uint8Array {
  let out = "";
  if (event.id) out += `id: ${event.id}\n`;
  if (event.event) out += `event: ${event.event}\n`;
  out += `data: ${JSON.stringify(event.data)}\n\n`;
  return ENCODER.encode(out);
}

export function sseStream(options: SseStreamOptions): Response {
  const abort = new AbortController();
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let bufferedBeforeSnapshot: SseEvent[] | null = [];

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (bytes: Uint8Array) => {
        try {
          controller.enqueue(bytes);
        } catch {
          // controller closed
        }
      };

      const handle: SseHandle = {
        signal: abort.signal,
        send(event) {
          if (abort.signal.aborted) return;
          if (bufferedBeforeSnapshot) {
            bufferedBeforeSnapshot.push(event);
            return;
          }
          enqueue(formatSse(event));
        },
        close(finalEvent) {
          if (abort.signal.aborted) return;
          if (finalEvent) enqueue(formatSse(finalEvent));
          abort.abort();
          if (heartbeat) clearInterval(heartbeat);
          try {
            controller.close();
          } catch {
            // already closed
          }
          void options.onClose?.(handle);
        },
      };

      heartbeat = setInterval(() => {
        if (abort.signal.aborted) return;
        enqueue(ENCODER.encode(":ping\n\n"));
      }, HEARTBEAT_INTERVAL_MS);

      try {
        await options.onSubscribe(handle);
        const snap = await options.snapshot(handle);
        enqueue(formatSse(snap));
        const buffered = bufferedBeforeSnapshot ?? [];
        bufferedBeforeSnapshot = null;
        for (const ev of buffered) enqueue(formatSse(ev));
      } catch (err) {
        enqueue(
          formatSse({
            event: "error",
            data: {
              message: err instanceof Error ? err.message : "stream failed",
            },
          }),
        );
        handle.close();
      }
    },

    cancel() {
      abort.abort();
      if (heartbeat) clearInterval(heartbeat);
      void options.onClose?.({
        signal: abort.signal,
        send: () => {},
        close: () => {},
      });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...(options.extraHeaders ?? {}),
    },
  });
}

/** Returned for reconnects to an already-terminal party so EventSource stops retrying. */
export function resolvedPartyShortCircuit(): Response {
  return new Response(null, { status: 204 });
}
