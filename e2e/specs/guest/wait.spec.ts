import { test, expect } from "../../fixtures/test-env";
import { joinAsGuest } from "../../fixtures/tenant-factory";
import { hostLoginViaApi } from "../../helpers/sign-in";

test.describe("guest wait page", () => {
  test("renders initial position from snapshot", async ({
    page,
    tenantFactory,
    request,
  }) => {
    const { slug } = await tenantFactory({ name: "Wait Test" });
    await joinAsGuest(request, slug, { name: "Ahead", partySize: 2 });
    // Must use page.request so the guest session cookie lands in page's browser context.
    const me = await joinAsGuest(page.request, slug, {
      name: "Me",
      partySize: 3,
    });

    await page.goto(me.waitUrl);
    await expect(page.getByText(/hi me/i)).toBeVisible();
    await expect(page.getByText(/in line/i)).toBeVisible();
  });

  test("position decreases within 1 second when party ahead is seated", async ({
    page,
    tenantFactory,
    request,
  }) => {
    const { slug, password } = await tenantFactory({ name: "Decrease Test" });
    const ahead = await joinAsGuest(request, slug, {
      name: "Ahead",
      partySize: 2,
    });
    const me = await joinAsGuest(page.request, slug, {
      name: "Me",
      partySize: 3,
    });

    const hostCookie = await hostLoginViaApi(request, slug, password);
    await page.goto(me.waitUrl);

    const positionLocator = page.locator(
      "[aria-live='polite'][aria-atomic='true']",
    );
    await expect(positionLocator).toContainText("2");

    // Host seats the party ahead of me.
    const seatRes = await request.post(
      `/api/host/${slug}/parties/${ahead.partyId}/seat`,
      { headers: { cookie: hostCookie } },
    );
    expect(seatRes.ok()).toBeTruthy();

    await expect(positionLocator).toContainText("1", { timeout: 5000 });
    await expect(page.getByText(/you.re next/i)).toBeVisible();
  });

  test("transitions to seated terminal when seated", async ({
    page,
    tenantFactory,
    request,
  }) => {
    const { slug, password } = await tenantFactory({ name: "Seat Test" });
    const me = await joinAsGuest(page.request, slug, {
      name: "Me",
      partySize: 2,
    });

    const hostCookie = await hostLoginViaApi(request, slug, password);
    await page.goto(me.waitUrl);
    await expect(page.getByText(/hi me/i)).toBeVisible();

    const seatRes = await request.post(
      `/api/host/${slug}/parties/${me.partyId}/seat`,
      {
        headers: { cookie: hostCookie },
      },
    );
    expect(seatRes.ok()).toBeTruthy();

    await expect(
      page.getByRole("heading", { name: /your table is ready/i }),
    ).toBeVisible({
      timeout: 5000,
    });
  });

  test("leave flow transitions to left terminal", async ({
    page,
    tenantFactory,
  }) => {
    const { slug } = await tenantFactory({ name: "Leave Test" });
    const me = await joinAsGuest(page.request, slug, {
      name: "Goodbye",
      partySize: 1,
    });

    await page.goto(me.waitUrl);
    await page.getByRole("button", { name: /leave the queue/i }).click();
    await page.getByRole("button", { name: /^leave queue$/i }).click();

    await expect(page.getByText(/see you soon/i)).toBeVisible();
  });
});
