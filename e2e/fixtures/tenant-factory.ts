import type { APIRequestContext } from "@playwright/test";

export interface TenantSetupInput {
  slug: string;
  name?: string;
  accentColor?: string;
  timezone?: string;
  isOpen?: boolean;
  isDemo?: boolean;
  password?: string;
  waitingParties?: Array<{
    name: string;
    partySize: number;
    phone?: string;
    minutesAgo?: number;
  }>;
}

export interface TenantHandle {
  id: string;
  slug: string;
  password: string;
}

export async function setupTenant(
  request: APIRequestContext,
  input: TenantSetupInput,
): Promise<TenantHandle> {
  const res = await request.post("/api/test/setup-tenant", { data: input });
  if (!res.ok()) {
    throw new Error(`setup-tenant failed (${res.status()}): ${await res.text()}`);
  }
  return (await res.json()) as TenantHandle;
}

export async function resetTenant(request: APIRequestContext, slug: string): Promise<void> {
  const res = await request.post("/api/test/reset-tenant", { data: { slug } });
  if (!res.ok()) {
    throw new Error(`reset-tenant failed (${res.status()}): ${await res.text()}`);
  }
}

export async function flushRedis(request: APIRequestContext): Promise<void> {
  const res = await request.post("/api/test/flush-redis");
  if (!res.ok()) {
    throw new Error(`flush-redis failed (${res.status()})`);
  }
}

export function uniqueSlug(prefix: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${suffix}`.toLowerCase();
}

export async function mintQrToken(
  request: APIRequestContext,
  slug: string,
): Promise<string> {
  const res = await request.get(`/api/display/${slug}/token`);
  if (!res.ok()) {
    throw new Error(`display token failed (${res.status()}): ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string };
  return body.token;
}

export interface JoinResult {
  waitUrl: string;
  partyId: string;
  cookies: string;
}

export async function joinAsGuest(
  request: APIRequestContext,
  slug: string,
  input: { name: string; partySize: number; phone?: string | null },
): Promise<JoinResult> {
  const token = await mintQrToken(request, slug);
  const res = await request.post(
    `/api/r/${slug}/join?t=${encodeURIComponent(token)}`,
    { data: { name: input.name, partySize: input.partySize, phone: input.phone ?? null } },
  );
  if (!res.ok()) {
    throw new Error(`join failed (${res.status()}): ${await res.text()}`);
  }
  const body = (await res.json()) as { waitUrl: string; partyId: string };
  const cookies = res.headers()["set-cookie"] ?? "";
  return { ...body, cookies };
}
