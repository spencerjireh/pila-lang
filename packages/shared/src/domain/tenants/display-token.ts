import { eq } from "drizzle-orm";

import { getDb } from "@pila/db/client";
import { tenants, type Tenant } from "@pila/db/schema";

import {
  QR_TOKEN_ROTATE_AFTER_MS,
  QR_TOKEN_TTL_MS,
  signQrToken,
} from "../../primitives/qr/token";

import { loadTenantBySlug } from "./lookup";

// Re-export so existing callers keep working until A17's codemod updates them.
export { loadTenantBySlug } from "./lookup";
export type { TenantLookup } from "./lookup";

export interface DisplayTokenPayload {
  token: string;
  validUntilMs: number;
  isOpen: boolean;
}

export interface TokenDecision {
  reuse: boolean;
  token: string;
  issuedAtMs: number;
  validUntilMs: number;
}

export function computeDisplayToken(
  tenant: Pick<Tenant, "slug" | "currentQrToken" | "qrTokenIssuedAt">,
  now: number = Date.now(),
): TokenDecision {
  const existingIssuedAtMs = tenant.qrTokenIssuedAt?.getTime();
  const fresh =
    typeof existingIssuedAtMs === "number" &&
    !!tenant.currentQrToken &&
    now - existingIssuedAtMs < QR_TOKEN_ROTATE_AFTER_MS;

  if (fresh) {
    return {
      reuse: true,
      token: tenant.currentQrToken!,
      issuedAtMs: existingIssuedAtMs!,
      validUntilMs: existingIssuedAtMs! + QR_TOKEN_TTL_MS,
    };
  }
  const token = signQrToken(tenant.slug, now);
  return {
    reuse: false,
    token,
    issuedAtMs: now,
    validUntilMs: now + QR_TOKEN_TTL_MS,
  };
}

export function toDisplayPayload(
  decision: TokenDecision,
  isOpen: boolean,
): DisplayTokenPayload {
  return {
    token: decision.token,
    validUntilMs: decision.validUntilMs,
    isOpen,
  };
}

export async function resolveDisplayToken(
  slug: string,
  now: number = Date.now(),
): Promise<
  | { ok: true; tenant: Tenant; payload: DisplayTokenPayload }
  | { ok: false; reason: "not_found" }
> {
  const lookup = await loadTenantBySlug(slug);
  if (!lookup.ok) return { ok: false, reason: "not_found" };

  const decision = computeDisplayToken(lookup.tenant, now);
  if (!decision.reuse) {
    await getDb()
      .update(tenants)
      .set({
        currentQrToken: decision.token,
        qrTokenIssuedAt: new Date(decision.issuedAtMs),
      })
      .where(eq(tenants.id, lookup.tenant.id));
  }
  return {
    ok: true,
    tenant: lookup.tenant,
    payload: toDisplayPayload(decision, lookup.tenant.isOpen),
  };
}
