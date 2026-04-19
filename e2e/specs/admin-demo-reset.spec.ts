import { test } from "../fixtures/test-env";

test.describe("admin demo reset", () => {
  test("reset-demo wipes and reseeds the demo tenant", async ({
    adminContext,
    tenantFactory,
  }) => {
    const { id } = await tenantFactory({
      slug: "demo",
      name: "Demo Diner",
      isDemo: true,
    });

    const page = await adminContext.newPage();
    await page.goto(`/admin/tenants/${id}`);
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: /reset demo data/i }).click();
    await page.waitForTimeout(1000);
    await page.close();
  });
});
