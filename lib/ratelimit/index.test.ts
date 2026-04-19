import { beforeEach, describe, expect, it } from "vitest";
import { RateLimitError, _resetForTests, consume, getLimiter, policy } from "./index";

describe("ratelimit", () => {
  beforeEach(() => {
    _resetForTests();
    getLimiter("loginPerIp", { useMemory: true });
    getLimiter("joinPerIp", { useMemory: true });
    getLimiter("displayRequestsPerIp", { useMemory: true });
  });

  it("consumes within budget", async () => {
    await expect(consume("loginPerIp", "1.2.3.4")).resolves.toBeUndefined();
    await expect(consume("loginPerIp", "1.2.3.4")).resolves.toBeUndefined();
  });

  it("throws RateLimitError with retryAfterSec when exceeded", async () => {
    const key = `test-exceed-${Math.random()}`;
    const { points } = policy("loginPerIp");
    for (let i = 0; i < points; i++) {
      await consume("loginPerIp", key);
    }
    await expect(consume("loginPerIp", key)).rejects.toMatchObject({
      name: "RateLimitError",
    });
    try {
      await consume("loginPerIp", key);
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      if (err instanceof RateLimitError) {
        expect(err.retryAfterSec).toBeGreaterThan(0);
      }
    }
  });

  it("different keys have independent budgets", async () => {
    const { points } = policy("joinPerIp");
    for (let i = 0; i < points; i++) {
      await consume("joinPerIp", "a");
    }
    await expect(consume("joinPerIp", "b")).resolves.toBeUndefined();
  });

  it("exposes spec-mandated policies", () => {
    expect(policy("displayRequestsPerIp")).toEqual({ points: 30, durationSec: 60 });
    expect(policy("joinPerPhone")).toEqual({ points: 10, durationSec: 3600 });
    expect(policy("joinGlobalPerTenant")).toEqual({ points: 200, durationSec: 3600 });
    expect(policy("guestStreamPerIp")).toEqual({ points: 10, durationSec: 60 });
    expect(policy("hostStreamPerIpSlug")).toEqual({ points: 30, durationSec: 60 });
    expect(policy("loginPerIp")).toEqual({ points: 10, durationSec: 3600 });
  });
});
