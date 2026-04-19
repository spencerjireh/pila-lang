import { test, expect } from "../fixtures/test-env";
import { fetchLatestMagicLink } from "../fixtures/mailbox";

test.describe("admin sign-in", () => {
  test("allow-listed email completes magic-link sign-in", async ({ page, request }) => {
    const email = process.env.E2E_ADMIN_EMAIL ?? "admin@example.com";

    await page.goto("/admin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole("button", { name: /send sign-in link/i }).click();
    await expect(page.getByText(/check your email/i)).toBeVisible();

    const { url } = await fetchLatestMagicLink(request, email);
    await page.goto(url);
    await page.waitForURL(/\/admin\/tenants/);
    await expect(page).toHaveURL(/\/admin\/tenants/);
  });

  test("non-allow-listed email cannot sign in", async ({ page, request }) => {
    const email = "not-allowed@example.com";
    await page.goto("/admin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole("button", { name: /send sign-in link/i }).click();

    // The route still claims to send — but no token row exists for this address.
    const res = await request.get(`/api/test/magic-link?email=${encodeURIComponent(email)}`);
    expect([404, 400]).toContain(res.status());
  });
});
