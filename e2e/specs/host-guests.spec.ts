import { test, expect } from "../fixtures/test-env";
import { hostLogin } from "../helpers/sign-in";

test.describe("host guests page", () => {
  test("shows phone-grouped history and handles infinite scroll", async ({
    page,
    tenantFactory,
  }) => {
    // Seed 27 distinct phones via setup-tenant so the first page is full and 2 more are on page 2.
    const waitingParties = Array.from({ length: 27 }, (_, i) => ({
      name: `Guest ${i + 1}`,
      partySize: 2,
      phone: `+1415555${String(i).padStart(4, "0")}`,
      minutesAgo: i,
    }));
    const { slug, password } = await tenantFactory({ name: "Guests Test", waitingParties });

    await hostLogin(page, slug, password);
    await page.goto(`/host/${slug}/guests`);

    // Wait for the first page — look for one of the seeded phones.
    await expect(page.getByText("+14155550000")).toBeVisible({ timeout: 10_000 });

    // Scroll to the bottom sentinel to trigger fetchNextPage.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // The 26th row (phone index 25) should eventually appear after the next page loads.
    await expect(page.getByText("+14155550025")).toBeVisible({ timeout: 10_000 });
  });
});
