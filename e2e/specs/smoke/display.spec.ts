import { test, expect } from "../../fixtures/test-env";
import { hostLoginViaApi } from "../../helpers/sign-in";

test.describe("display page", () => {
  test("renders tenant name and QR on open tenant with no flash", async ({
    page,
    tenantFactory,
  }) => {
    const { slug } = await tenantFactory({
      name: "Display Test",
      isOpen: true,
    });
    await page.goto(`/display/${slug}`);

    await expect(page.getByText(/display test/i).first()).toBeVisible();
    await expect(page.getByLabel(/QR code to join/i)).toBeVisible();
  });

  test("shows closed banner when tenant is closed", async ({
    page,
    tenantFactory,
  }) => {
    const { slug } = await tenantFactory({
      name: "Closed Diner",
      isOpen: false,
    });
    await page.goto(`/display/${slug}`);

    await expect(
      page.getByRole("heading", { name: /not accepting guests/i }),
    ).toBeVisible();
    await expect(page.getByLabel(/QR code to join/i)).toHaveCount(0);
  });

  test("swaps QR for closed banner within 60s when host closes queue", async ({
    page,
    tenantFactory,
    request,
  }) => {
    const { slug, password } = await tenantFactory({
      name: "Live Close Test",
      isOpen: true,
    });

    await page.goto(`/display/${slug}`);
    await expect(page.getByLabel(/QR code to join/i)).toBeVisible();

    const cookie = await hostLoginViaApi(request, slug, password);
    const res = await request.post(`/api/host/${slug}/close`, {
      headers: { cookie },
    });
    expect(res.ok()).toBeTruthy();

    await expect(
      page.getByRole("heading", { name: /not accepting guests/i }),
    ).toBeVisible({
      timeout: 70_000,
    });
  });
});
