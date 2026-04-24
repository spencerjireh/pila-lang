import { test, expect } from "../../fixtures/test-env";

test.describe("host login", () => {
  test("correct password lands on /queue", async ({ page, tenantFactory }) => {
    const { slug, password } = await tenantFactory({ name: "Login Happy" });
    await page.goto(`/host/${slug}`);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(new RegExp(`/host/${slug}/queue$`));
    await expect(page.getByRole("heading", { name: /waiting/i })).toBeVisible();
  });

  test("wrong password shows inline error", async ({ page, tenantFactory }) => {
    const { slug } = await tenantFactory({ name: "Login Bad" });
    await page.goto(`/host/${slug}`);
    await page.getByLabel(/password/i).fill("not-the-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/wrong password/i)).toBeVisible();
  });
});
