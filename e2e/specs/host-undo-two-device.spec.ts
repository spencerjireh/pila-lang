import { test, expect } from "../fixtures/test-env";
import { hostLogin, hostLoginViaApi } from "../helpers/sign-in";

test.describe("host undo across devices", () => {
  test("seat on A surfaces to B; undo via API restores party in A's waiting list", async ({
    browser,
    tenantFactory,
    request,
  }) => {
    const { slug, password } = await tenantFactory({
      name: "Undo Test",
      waitingParties: [{ name: "Alice Restore", partySize: 2, minutesAgo: 5 }],
    });

    const ctxA = await browser.newContext();
    const pageA = await ctxA.newPage();
    await hostLogin(pageA, slug, password);
    await expect(pageA.getByText("Alice Restore")).toBeVisible();

    // Device B's view of the queue — confirm A-side stream propagation to another device.
    const ctxB = await browser.newContext();
    const pageB = await ctxB.newPage();
    await hostLogin(pageB, slug, password);
    await expect(pageB.getByText("Alice Restore")).toBeVisible();

    // Seat on A via its row.
    await pageA
      .locator("li", { hasText: "Alice Restore" })
      .getByRole("button", { name: /^seat$/i })
      .click();

    // Both sides see the waiting list empty — the SSE propagated the removal.
    await expect(pageA.getByRole("heading", { name: /waiting \(0\)/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(pageB.getByRole("heading", { name: /waiting \(0\)/i })).toBeVisible({
      timeout: 15_000,
    });

    // Undo via the host API from any session. Both sides should see the restore.
    const cookie = await hostLoginViaApi(request, slug, password);
    const undoRes = await request.post(`/api/host/${slug}/undo`, { headers: { cookie } });
    expect(undoRes.ok()).toBeTruthy();

    await expect(pageA.getByText("Alice Restore")).toBeVisible({ timeout: 10_000 });
    await expect(pageB.getByText("Alice Restore")).toBeVisible({ timeout: 10_000 });

    await ctxA.close();
    await ctxB.close();
  });
});
