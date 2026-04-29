import type { APIRequestContext, Page } from "@playwright/test";

import { apiUrl } from "./api-url";

export async function hostLogin(
  page: Page,
  slug: string,
  password: string,
): Promise<void> {
  await page.goto(`/host/${slug}`);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL(new RegExp(`/host/${slug}/queue$`));
}

export async function hostLoginViaApi(
  request: APIRequestContext,
  slug: string,
  password: string,
): Promise<string> {
  const res = await request.post(apiUrl(`/api/v1/host/${slug}/login`), {
    data: { password },
  });
  if (!res.ok()) {
    throw new Error(`host login failed (${res.status()}): ${await res.text()}`);
  }
  const cookies = res.headers()["set-cookie"] ?? "";
  return cookies;
}
