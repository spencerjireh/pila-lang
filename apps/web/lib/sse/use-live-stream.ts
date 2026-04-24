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
    const es = new EventSource(url);
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
