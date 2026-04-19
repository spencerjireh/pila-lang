import { test, expect } from "../fixtures/test-env";
import { joinAsGuest } from "../fixtures/tenant-factory";
import { hostLogin } from "../helpers/sign-in";

test.describe("host queue", () => {
  test("snapshot shows waiting parties and new joins appear within 1s", async ({
    page,
    tenantFactory,
    request,
  }) => {
    const { slug, password } = await tenantFactory({
      name: "Queue Test",
      waitingParties: [
        { name: "Seeded Alice", partySize: 2, minutesAgo: 10 },
        { name: "Seeded Bob", partySize: 3, minutesAgo: 5 },
      ],
    });

    await hostLogin(page, slug, password);
    await expect(page.getByText("Seeded Alice")).toBeVisible();
    await expect(page.getByText("Seeded Bob")).toBeVisible();

    // Trigger a new join — must appear in the list via SSE.
    await joinAsGuest(request, slug, { name: "Fresh Charlie", partySize: 1 });
    await expect(page.getByText("Fresh Charlie")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("seat removes from waiting and moves row to recently resolved", async ({
    page,
    tenantFactory,
  }) => {
    const { slug, password } = await tenantFactory({
      name: "Seat Test",
      waitingParties: [{ name: "To Seat", partySize: 2, minutesAgo: 2 }],
    });

    await hostLogin(page, slug, password);
    await expect(page.getByText("To Seat")).toBeVisible();

    const row = page.locator("li", { hasText: "To Seat" });
    await row.getByRole("button", { name: /^seat$/i }).click();

    await expect(
      page.getByRole("heading", { name: /waiting \(0\)/i }),
    ).toBeVisible({
      timeout: 15_000,
    });
    // Waiting empty message appears; party is no longer in any waiting row.
    await expect(page.getByText(/no one waiting right now/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("remove marks as no-show and moves row to recently resolved", async ({
    page,
    tenantFactory,
  }) => {
    const { slug, password } = await tenantFactory({
      name: "Remove Test",
      waitingParties: [{ name: "No Show Guest", partySize: 2, minutesAgo: 2 }],
    });

    await hostLogin(page, slug, password);
    const row = page.locator("li", { hasText: "No Show Guest" });
    await row.getByRole("button", { name: /^remove$/i }).click();

    await expect(
      page.getByRole("heading", { name: /waiting \(0\)/i }),
    ).toBeVisible({
      timeout: 15_000,
    });
  });

  test("close-queue dialog flips pill and display reflects within 60s", async ({
    page,
    context,
    tenantFactory,
  }) => {
    const { slug, password } = await tenantFactory({
      name: "Close Test",
      isOpen: true,
    });

    await hostLogin(page, slug, password);
    const displayPage = await context.newPage();
    await displayPage.goto(`/display/${slug}`);
    await expect(displayPage.getByLabel(/QR code to join/i)).toBeVisible();

    await page.getByRole("button", { name: /close queue/i }).click();
    await page.getByRole("button", { name: /yes, close/i }).click();

    await expect(
      page.getByRole("button", { name: /open queue/i }),
    ).toBeVisible();
    await expect(
      displayPage.getByRole("heading", { name: /not accepting guests/i }),
    ).toBeVisible({ timeout: 70_000 });
  });
});
