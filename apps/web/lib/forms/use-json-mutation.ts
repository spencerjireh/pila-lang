"use client";

import { useCallback, useState } from "react";

export type MutationStatus = "idle" | "submitting" | "error" | "success";

type ErrorEnvelope = {
  error?: string;
  reason?: string;
  retryAfterSec?: number;
  [key: string]: unknown;
};

export interface MutateOptions {
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  /** Called on 401; hook sets status back to idle and skips error rendering. */
  onUnauthorized?: () => void;
  /**
   * Map a non-2xx response to a user-facing message. Return null to suppress
   * error rendering (e.g. when the caller wants to react to the response
   * directly). The envelope follows the canonical `{ error, reason?, … }`
   * shape produced by `errorResponse()`.
   */
  errorMap?: (info: {
    status: number;
    error: string | undefined;
    body: ErrorEnvelope | null;
  }) => string | null;
  /** Default message for thrown fetch/parse errors. */
  networkError?: string;
  /** Default message when no errorMap matches. */
  fallbackError?: string;
}

export interface UseJsonMutationHandle<Body, Resp> {
  mutate: (
    url: string,
    body: Body,
    opts?: MutateOptions,
  ) => Promise<Resp | null>;
  status: MutationStatus;
  error: string | null;
  reset: () => void;
}

const DEFAULT_NETWORK_ERROR = "Network hiccup. Try again.";
const DEFAULT_FALLBACK_ERROR = "Something went wrong. Try again.";

/**
 * JSON form submission with standardised 429 / 401 / network handling.
 * Returns the parsed response on success; null on any non-2xx outcome
 * (including unauthorized, where `onUnauthorized` fires instead).
 */
export function useJsonMutation<
  Body = unknown,
  Resp = unknown,
>(): UseJsonMutationHandle<Body, Resp> {
  const [status, setStatus] = useState<MutationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (
      url: string,
      body: Body,
      opts: MutateOptions = {},
    ): Promise<Resp | null> => {
      setStatus("submitting");
      setError(null);

      try {
        const res = await fetch(url, {
          method: opts.method ?? "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          let data: Resp;
          try {
            data = (await res.json()) as Resp;
          } catch {
            data = undefined as unknown as Resp;
          }
          setStatus("success");
          return data;
        }

        if (res.status === 401 && opts.onUnauthorized) {
          setStatus("idle");
          opts.onUnauthorized();
          return null;
        }

        const envelope = (await res
          .json()
          .catch(() => null)) as ErrorEnvelope | null;
        const code = envelope?.error;

        let message: string | null = null;
        if (res.status === 429 && typeof envelope?.retryAfterSec === "number") {
          message = `Too many requests. Try again in ${envelope.retryAfterSec} seconds.`;
        } else if (opts.errorMap) {
          message = opts.errorMap({
            status: res.status,
            error: code,
            body: envelope,
          });
        }
        if (message === null) {
          setStatus("idle");
          return null;
        }
        setStatus("error");
        setError(message ?? opts.fallbackError ?? DEFAULT_FALLBACK_ERROR);
        return null;
      } catch {
        setStatus("error");
        setError(opts.networkError ?? DEFAULT_NETWORK_ERROR);
        return null;
      }
    },
    [],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { mutate, status, error, reset };
}
