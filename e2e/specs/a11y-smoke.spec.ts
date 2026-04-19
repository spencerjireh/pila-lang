import { test } from "../fixtures/test-env";
import { assertAxe } from "../helpers/axe";
import { mintQrToken } from "../fixtures/tenant-factory";

test.describe("axe-core smoke scan", () => {
  test("display page has no axe violations", async ({
    page,
    tenantFactory,
  }) => {
    const { slug } = await tenantFactory({ name: "A11y Display" });
    await page.goto(`/display/${slug}`);
    await assertAxe(page, "display");
  });

  test("join page (valid token) has no axe violations", async ({
    page,
    tenantFactory,
    request,
  }) => {
    const { slug } = await tenantFactory({ name: "A11y Join" });
    const token = await mintQrToken(request, slug);
    await page.goto(`/r/${slug}?t=${token}`);
    await assertAxe(page, "join");
  });

  test("host login has no axe violations", async ({ page, tenantFactory }) => {
    const { slug } = await tenantFactory({ name: "A11y Host Login" });
    await page.goto(`/host/${slug}`);
    await assertAxe(page, "host-login");
  });

  test("admin sign-in has no axe violations", async ({ page }) => {
    await page.goto("/admin");
    await assertAxe(page, "admin-signin");
  });
});
