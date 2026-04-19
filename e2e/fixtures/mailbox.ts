import type { APIRequestContext } from "@playwright/test";

export interface MagicLinkResponse {
  url: string;
  at: number;
}

export async function fetchLatestMagicLink(
  request: APIRequestContext,
  email: string,
): Promise<MagicLinkResponse> {
  const res = await request.get(`/api/test/magic-link?email=${encodeURIComponent(email)}`);
  if (!res.ok()) {
    throw new Error(`magic-link failed (${res.status()}): ${await res.text()}`);
  }
  return (await res.json()) as MagicLinkResponse;
}
