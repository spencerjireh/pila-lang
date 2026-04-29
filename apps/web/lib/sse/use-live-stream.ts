"use client";

import { useEffect, useRef, useState } from "react";

export interface UseLiveStreamOptions<E> {
  url: string;
  /** Called for every successfully-parsed event. */
  onEvent: (ev: E) => void;
  /** Set false to pause the subscription (e.g. after a terminal event). */
  enabled?: boolean;
}

export interface UseLiveStreamHandle {
  /** True while the EventSource is disconnected and retrying. */
  reconnecting: boolean;
  /** Close the underlying EventSource (e.g. before navigation or a mutation). */
  close(): void;
}

/**
 * Client-side counterpart of `lib/sse/stream.ts`: wraps an `EventSource`
 * with open/error tracking and safe JSON parsing. EventSource handles
 * reconnects natively; this hook only surfaces the disconnected state.
 */
export function useLiveStream<E>(
  options: UseLiveStreamOptions<E>,
): UseLiveStreamHandle {
  const { url, onEvent, enabled = true } = options;
  const [reconnecting, setReconnecting] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) return;
    // SSE bypasses Next rewrites: target apps/api directly so the dev-server
    // proxy can't buffer streaming responses. Same-origin in prod via Traefik
    // means NEXT_PUBLIC_API_BASE_URL is empty there and this is a no-op.
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const fullUrl = url.startsWith("http") ? url : `${base}${url}`;
    const es = new EventSource(fullUrl, { withCredentials: true });
    esRef.current = es;
    es.onopen = () => setReconnecting(false);
    es.onerror = () => setReconnecting(true);
    es.onmessage = (msg) => {
      let ev: E;
      try {
        ev = JSON.parse(msg.data) as E;
      } catch {
        return;
      }
      onEventRef.current(ev);
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [url, enabled]);

  return {
    reconnecting,
    close: () => {
      esRef.current?.close();
      esRef.current = null;
    },
  };
}
