import { test, expect } from "../../fixtures/test-env";
import { mintQrToken } from "../../fixtures/tenant-factory";

test.describe("rate limits", () => {
  test.beforeEach(async ({ request }) => {
    await request.post("/api/test/flush-redis");
  });

  test("11th join with same phone at same tenant is blocked with 429", async ({
    request,
    tenantFactory,
  }) => {
    const { slug } = await tenantFactory({ name: "RL Phone" });
    const phone = "+14155558888";

    // Hit the unique-waiting index first: 10 joins with same phone would conflict.
    // Instead hammer the join endpoint 11 times with the same phone/token combo —
    // 1st succeeds, 2..10 get "already_waiting" (409), and 11th should trip the phone rate limit.
    let blocked = false;
    for (let i = 0; i < 11; i++) {
      const token = await mintQrToken(request, slug).catch(() => null);
      if (!token) break;
      const res = await request.post(
        `/api/r/${slug}/join?t=${encodeURIComponent(token)}`,
        {
          data: { name: `Guest ${i}`, partySize: 2, phone },
        },
      );
      if (res.status() === 429) {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBeTruthy();
  });

  test("31st display token request per IP is blocked with 429", async ({
    request,
    tenantFactory,
  }) => {
    const { slug } = await tenantFactory({ name: "RL Display" });

    let lastStatus = 0;
    for (let i = 0; i < 32; i++) {
      const res = await request.get(`/api/display/${slug}/token`);
      lastStatus = res.status();
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
