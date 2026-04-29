import { test as base, expect, type BrowserContext } from "@playwright/test";

import { apiUrl } from "../helpers/api-url";

import {
  flushRedis,
  resetTenant,
  setupTenant,
  uniqueSlug,
  type TenantHandle,
  type TenantSetupInput,
} from "./tenant-factory";

interface Fixtures {
  tenantFactory: (
    input?: Partial<TenantSetupInput> & { slug?: string },
  ) => Promise<TenantHandle>;
  adminContext: BrowserContext;
}

export const test = base.extend<Fixtures>({
  tenantFactory: async ({ request }, use) => {
    const created: string[] = [];
    await flushRedis(request);
    await use(async (input = {}) => {
      const slug = input.slug ?? uniqueSlug("spec");
      const handle = await setupTenant(request, { ...input, slug });
      created.push(slug);
      return handle;
    });
    for (const slug of created) {
      await resetTenant(request, slug).catch(() => undefined);
    }
  },

  adminContext: async ({ browser, request, baseURL }, use) => {
    const email = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";
    const res = await request.post(apiUrl("/api/v1/test/sign-in-as-admin"), {
      data: { email },
    });
    if (!res.ok()) {
      throw new Error(
        `sign-in-as-admin failed (${res.status()}): ${await res.text()}`,
      );
    }
    const setCookie = res.headers()["set-cookie"] ?? "";
    const pair = setCookie.split(";")[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq < 1) {
      throw new Error(`sign-in-as-admin returned no cookie: ${setCookie}`);
    }
    const cookieName = pair.slice(0, eq);
    const cookieValue = pair.slice(eq + 1);
    const context = await browser.newContext({ baseURL });
    const host = new URL(baseURL ?? "http://localhost:3000").hostname;
    await context.addCookies([
      {
        name: cookieName,
        value: cookieValue,
        domain: host,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        expires: Math.floor(Date.now() / 1000) + 24 * 3600,
      },
    ]);
    await use(context);
    await context.close();
  },
});

export { expect };
