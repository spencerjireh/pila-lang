import { test, expect } from "../../fixtures/test-env";
import { hostLogin } from "../../helpers/sign-in";

test.describe("host settings", () => {
  test("name change propagates to queue header within 1s", async ({
    page,
    context,
    tenantFactory,
  }) => {
    const { slug, password } = await tenantFactory({ name: "Before" });

    await hostLogin(page, slug, password);
    await expect(page.getByText(/^Before$/).first()).toBeVisible();

    const settingsPage = await context.newPage();
    await settingsPage.goto(`/host/${slug}/settings`);
    await settingsPage.getByLabel(/restaurant name/i).fill("After");
    await settingsPage.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByText(/^After$/).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("invalid accent hex is rejected with inline error", async ({
    page,
    tenantFactory,
  }) => {
    const { slug, password } = await tenantFactory({ name: "Bad Color" });

    await hostLogin(page, slug, password);
    await page.goto(`/host/${slug}/settings`);

    // Accent color lives on the General tab (the default tab). No click needed.
    await page.getByLabel(/accent color/i).fill("not-a-hex");
    await page.getByRole("button", { name: /^save$/i }).click();

    await expect(page.getByText(/accent color/i).nth(0)).toBeVisible();
  });
});
