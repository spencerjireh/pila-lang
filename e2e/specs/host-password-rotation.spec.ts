import { test, expect } from "../fixtures/test-env";
import { hostLogin, hostLoginViaApi } from "../helpers/sign-in";

test.describe("host password rotation", () => {
  test("rotating keeps the rotating device logged in; other device gets 401", async ({
    browser,
    request,
    tenantFactory,
  }) => {
    const { slug, password } = await tenantFactory({ name: "Rotate Test" });

    // Device A — browser context used to rotate.
    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await hostLogin(pageA, slug, password);

    // Device B — independent login. We'll verify B's session gets kicked.
    const bCookie = await hostLoginViaApi(request, slug, password);
    expect(bCookie).toContain("host_session");

    // Rotate on A.
    await pageA.goto(`/host/${slug}/settings`);
    await pageA.getByRole("tab", { name: /password/i }).click();
    await pageA.getByLabel(/^new password$/i).fill("new-strong-pw-123");
    await pageA.getByLabel(/confirm new password/i).fill("new-strong-pw-123");
    const rotateRes = pageA.waitForResponse(
      (res) =>
        res.url().includes(`/api/host/${slug}/settings/password`) &&
        res.request().method() === "POST",
    );
    await pageA.getByRole("button", { name: /change password/i }).click();
    await rotateRes;

    // A is still authenticated.
    await pageA.goto(`/host/${slug}/queue`);
    await expect(pageA).toHaveURL(new RegExp(`/host/${slug}/queue$`));

    // B's old cookie now gets 401 from any host API.
    const seatAttempt = await request.post(`/api/host/${slug}/open`, {
      headers: { cookie: bCookie },
    });
    expect(seatAttempt.status()).toBe(401);

    await ctxA.close();
  });

  test("logout-others bumps version and kicks other device without changing password", async ({
    browser,
    request,
    tenantFactory,
  }) => {
    const { slug, password } = await tenantFactory({ name: "Kick Test" });

    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await hostLogin(pageA, slug, password);

    const bCookie = await hostLoginViaApi(request, slug, password);

    await pageA.goto(`/host/${slug}/settings`);
    await pageA.getByRole("tab", { name: /password/i }).click();
    await pageA
      .getByRole("button", { name: /sign out other devices/i })
      .click();
    const kickRes = pageA.waitForResponse(
      (res) =>
        res.url().includes(`/api/host/${slug}/settings/password`) &&
        res.request().method() === "POST",
    );
    await pageA.getByRole("button", { name: /yes, sign out others/i }).click();
    await kickRes;

    const res = await request.post(`/api/host/${slug}/open`, {
      headers: { cookie: bCookie },
    });
    expect(res.status()).toBe(401);

    // Original password still works (fresh login succeeds).
    const cCookie = await hostLoginViaApi(request, slug, password);
    expect(cCookie).toContain("host_session");

    await ctxA.close();
  });
});
