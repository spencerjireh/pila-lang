import { test, expect } from "../fixtures/test-env";

test.describe("admin delete tenant", () => {
  test("typed-slug confirmation is required to delete", async ({
    adminContext,
    tenantFactory,
  }) => {
    const { id, slug } = await tenantFactory({ name: "Delete Me" });

    const page = await adminContext.newPage();
    await page.goto(`/admin/tenants/${id}`);
    await page.getByRole("button", { name: /^delete tenant$/i }).click();

    const confirmInput = page.locator("#confirm-slug");
    await confirmInput.fill("wrong-slug");
    const finalDelete = page.getByRole("button", {
      name: /permanently delete/i,
    });
    await expect(finalDelete).toBeDisabled();

    await confirmInput.fill(slug);
    await expect(finalDelete).toBeEnabled();
    await finalDelete.click();

    await page.waitForURL(/\/admin\/tenants$/);
    await page.close();
  });
});
