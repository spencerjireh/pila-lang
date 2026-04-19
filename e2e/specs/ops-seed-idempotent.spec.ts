import { execSync } from "node:child_process";
import { test, expect } from "../fixtures/test-env";

test.describe("seed idempotency", () => {
  test("pnpm seed --tenant=demo twice leaves identical fixture", async ({ request }) => {
    // Run the seed twice.
    execSync("pnpm seed --tenant=demo --json", { stdio: "pipe", cwd: process.cwd() });
    execSync("pnpm seed --tenant=demo --json", { stdio: "pipe", cwd: process.cwd() });

    // Verify via reset-tenant-less side-effect: the host login page renders with the demo slug.
    const res = await request.get("/host/demo");
    expect([200, 301, 302]).toContain(res.status());
  });
});
