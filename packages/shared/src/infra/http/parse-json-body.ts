import type { NextRequest } from "next/server";
import type { z } from "zod";

import { errorResponse } from "./error-response";

export type ParseJsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: Response };

/**
 * Guard the first three steps of every JSON route handler:
 *   1. reject non-`application/json` requests with 415
 *   2. reject malformed JSON with 400 `invalid_body`
 *   3. reject schema-invalid bodies with 400 `invalid_body` + `issues`
 *
 * Returns the parsed, typed body on success.
 *
 * Example:
 *   const parsed = await parseJsonBody(req, loginSchema);
 *   if (!parsed.ok) return parsed.response;
 *   const { password } = parsed.data;
 */
export async function parseJsonBody<Schema extends z.ZodTypeAny>(
  req: NextRequest,
  schema: Schema,
): Promise<ParseJsonBodyResult<z.infer<Schema>>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return { ok: false, response: errorResponse(415, "bad_content_type") };
  }

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: errorResponse(400, "invalid_body", {
        issues: parsed.error.flatten(),
      }),
    };
  }
  return { ok: true, data: parsed.data };
}
