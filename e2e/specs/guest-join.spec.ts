import { test, expect } from "../fixtures/test-env";
import { mintQrToken } from "../fixtures/tenant-factory";

test.describe("guest join", () => {
  test("shows missing-token banner without ?t", async ({
    page,
    tenantFactory,
  }) => {
    const { slug } = await tenantFactory({ name: "No Token Diner" });
    await page.goto(`/r/${slug}`);
    await expect(
      page.getByRole("heading", { name: /scan the QR code to join/i }),
    ).toBeVisible();
  });

  test("rejects invalid token with invalid banner", async ({
    page,
    tenantFactory,
  }) => {
    const { slug } = await tenantFactory({ name: "Invalid Token Diner" });
    await page.goto(`/r/${slug}?t=not-a-real-token`);
    await expect(
      page.getByRole("heading", { name: /isn't valid/i }),
    ).toBeVisible();
  });

  test("shows closed banner when tenant is closed", async ({
    page,
    tenantFactory,
    request,
  }) => {
    const { slug } = await tenantFactory({
      name: "Closed Diner",
      isOpen: false,
    });
    const token = await mintQrToken(request, slug).catch(() => "");
    await page.goto(`/r/${slug}${token ? `?t=${token}` : ""}`);
    await expect(
      page.getByRole("heading", { name: /not accepting guests/i }),
    ).toBeVisible();
  });

  test("successful join lands on wait page with position 1", async ({
    page,
    tenantFactory,
    request,
  }) => {
    const { slug } = await tenantFactory({ name: "Happy Diner" });
    const token = await mintQrToken(request, slug);
    await page.goto(`/r/${slug}?t=${token}`);

    await page.getByLabel(/^name$/i).fill("Priya");
    await page.getByLabel(/party size/i).selectOption("2");
    await page.getByRole("button", { name: /join the queue/i }).click();

    await page.waitForURL(new RegExp(`/r/${slug}/wait/`));
    await expect(page.getByText(/hi priya/i)).toBeVisible();
    await expect(page.getByText(/you're next/i)).toBeVisible();
  });

  test("same-device revisit while waiting redirects to wait page", async ({
    page,
    context,
    tenantFactory,
  }) => {
    const { slug } = await tenantFactory({ name: "Revisit Diner" });
    const token = await mintQrToken(page.request, slug);

    await page.goto(`/r/${slug}?t=${token}`);
    await page.getByLabel(/^name$/i).fill("Rahul");
    await page.getByLabel(/party size/i).selectOption("3");
    await page.getByRole("button", { name: /join the queue/i }).click();
    await page.waitForURL(new RegExp(`/r/${slug}/wait/`));

    // Confirm the guest session cookie was planted in the context.
    const cookies = await context.cookies();
    expect(cookies.some((c) => c.name === "party_session")).toBeTruthy();

    const token2 = await mintQrToken(page.request, slug);
    await page.goto(`/r/${slug}?t=${token2}`);
    await expect(page).toHaveURL(new RegExp(`/r/${slug}/wait/`));
  });
});
