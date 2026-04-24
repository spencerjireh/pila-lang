/**
 * Canonical error envelope for every pila API response. Shape:
 *
 *   { error: <code>, reason?, issues?, retryAfterSec?, ...extras }
 *
 * - `error` is always present and is a short machine code (e.g.
 *   "invalid_body", "rate_limited", "not_found").
 * - `reason` is an optional human-readable sub-code (e.g. "format" for an
 *   invalid accent color).
 * - `issues` carries Zod flatten() output for validation failures.
 * - `retryAfterSec` mirrors the `Retry-After` header for 429s so JS clients
 *   can parse it without touching headers.
 * - `extras` is an escape hatch for domain-specific fields (used sparingly).
 *
 * Setting `retryAfterSec` also sets the `Retry-After` header automatically.
 */

export interface ErrorResponseInit {
  reason?: string;
  issues?: unknown;
  retryAfterSec?: number;
  headers?: Record<string, string>;
  extras?: Record<string, unknown>;
}

export function errorResponse(
  status: number,
  code: string,
  init?: ErrorResponseInit,
): Response {
  const body: Record<string, unknown> = { error: code };
  if (init?.reason !== undefined) body.reason = init.reason;
  if (init?.issues !== undefined) body.issues = init.issues;
  if (init?.retryAfterSec !== undefined) {
    body.retryAfterSec = init.retryAfterSec;
  }
  if (init?.extras) Object.assign(body, init.extras);

  const headers: Record<string, string> = { ...(init?.headers ?? {}) };
  if (init?.retryAfterSec !== undefined) {
    headers["Retry-After"] = String(init.retryAfterSec);
  }
  return Response.json(body, { status, headers });
}
