import { test, expect } from "../../fixtures/test-env";
import { joinAsGuest } from "../../fixtures/tenant-factory";
import { hostLoginViaApi } from "../../helpers/sign-in";

interface NotifierCall {
  type: "onPartyJoined" | "onPartyReady";
  party: { id: string; name: string };
  at: string;
}

async function drain(request: import("@playwright/test").APIRequestContext) {
  const res = await request.get("/api/test/notifier/calls");
  if (!res.ok()) throw new Error(`notifier drain failed: ${res.status()}`);
  return (await res.json()) as { calls: NotifierCall[]; note?: string };
}

test.describe("notifier wiring", () => {
  test("join fires onPartyJoined; seat fires onPartyReady", async ({
    request,
    tenantFactory,
  }) => {
    const { slug, password } = await tenantFactory({ name: "Notifier Test" });

    await drain(request); // clear buffer

    const me = await joinAsGuest(request, slug, {
      name: "NotifyMe",
      partySize: 2,
    });

    // Small delay to let async notifier call land.
    await new Promise((r) => setTimeout(r, 500));
    const afterJoin = await drain(request);
    expect(
      afterJoin.calls.some(
        (c) => c.type === "onPartyJoined" && c.party.name === "NotifyMe",
      ),
    ).toBeTruthy();

    const cookie = await hostLoginViaApi(request, slug, password);
    const seatRes = await request.post(
      `/api/host/${slug}/parties/${me.partyId}/seat`,
      {
        headers: { cookie },
      },
    );
    expect(seatRes.ok()).toBeTruthy();

    await new Promise((r) => setTimeout(r, 500));
    const afterSeat = await drain(request);
    expect(
      afterSeat.calls.some(
        (c) => c.type === "onPartyReady" && c.party.name === "NotifyMe",
      ),
    ).toBeTruthy();
  });
});
