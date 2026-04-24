import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const EXTERNAL = process.env.E2E_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: EXTERNAL
    ? undefined
    : {
        command:
          "pnpm --filter @pila/web build && pnpm --filter @pila/web start",
        url: `${BASE_URL}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "pipe",
        stderr: "pipe",
        env: {
          NODE_ENV: "test",
          // These propagate from the caller's shell — playwright's webServer inherits env by default.
        },
      },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testMatch: /(smoke\/sales-demo|guest\/wait)\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
