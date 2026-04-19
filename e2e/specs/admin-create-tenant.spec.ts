import { test, expect } from "../fixtures/test-env";
import { uniqueSlug } from "../fixtures/tenant-factory";

test.describe("admin create tenant", () => {
  test("create returns the initial password exactly once", async ({ adminContext }) => {
    const page = await adminContext.newPage();
    await page.goto("/admin/tenants/new");

    const slug = uniqueSlug("created");
    await page.getByLabel(/name/i).fill("Fresh Tenant");
    await page.getByLabel(/slug/i).fill(slug);
    // Timezone defaults to Asia/Kolkata — leave it.

    await page.getByRole("button", { name: /create tenant/i }).click();

    // One-time password dialog shows the plaintext.
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /initial host password/i }),
    ).toBeVisible();
    await page.close();
  });

  test("reserved slug is rejected with inline error", async ({ adminContext }) => {
    const page = await adminContext.newPage();
    await page.goto("/admin/tenants/new");

    await page.getByLabel(/name/i).fill("Reserved Tenant");
    // "admin" should be on the reserved list per slug validator.
    await page.getByLabel(/slug/i).fill("admin");
    await page.getByRole("button", { name: /create tenant/i }).click();

    await expect(page.getByText(/reserved/i)).toBeVisible();
    await page.close();
  });
});
