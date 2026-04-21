import { test, expect } from "../fixtures/test-env";
import { mintQrToken } from "../fixtures/tenant-factory";

test.describe("sales demo", () => {
  test("end-to-end sales flow completes under wall-clock budget", async ({
    browser,
    tenantFactory,
    request,
  }) => {
    const started = Date.now();
    const { slug, password } = await tenantFactory({ name: "Sales Demo" });

    // Display in one context (mobile viewport).
    const displayCtx = await browser.newContext();
    const display = await displayCtx.newPage();
    await display.goto(`/display/${slug}`);
    await expect(display.getByLabel(/QR code to join/i)).toBeVisible();

    // Guest in another context.
    const guestCtx = await browser.newContext();
    const guest = await guestCtx.newPage();
    const token = await mintQrToken(request, slug);
    await guest.goto(`/r/${slug}?t=${token}`);
    await guest.getByLabel(/your name/i).fill("Sales Demo Guest");
    await guest.getByRole("combobox").click();
    await guest.getByRole("option", { name: "2", exact: true }).click();
    await guest.getByRole("button", { name: /join the queue/i }).click();
    await guest.waitForURL(new RegExp(`/r/${slug}/wait/`));
    await expect(guest.getByText(/you.re next/i)).toBeVisible();

    // Host signs in and seats the guest.
    const hostCtx = await browser.newContext();
    const host = await hostCtx.newPage();
    await host.goto(`/host/${slug}`);
    await host.getByLabel(/password/i).fill(password);
    await host.getByRole("button", { name: /sign in/i }).click();
    await host.waitForURL(new RegExp(`/host/${slug}/queue$`));
    await host
      .locator("li", { hasText: "Sales Demo Guest" })
      .getByRole("button", { name: /^seat$/i })
      .click();

    await expect(guest.getByText(/your table is ready/i)).toBeVisible({
      timeout: 10_000,
    });

    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(270_000); // budget 4:30

    await displayCtx.close();
    await guestCtx.close();
    await hostCtx.close();
  });
});
