import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";
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
  // Two long-running servers: apps/api on 3001 (must come first so the Next
  // dev-server rewrite to /api/v1/* and the EventSource direct hits work),
  // and apps/web on 3000. CI sets E2E_EXTERNAL_SERVER=1 and starts both
  // services itself.
  webServer: EXTERNAL
    ? undefined
    : [
        {
          command: "pnpm --filter @pila/api start",
          url: `${API_BASE_URL}/api/v1/health`,
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            NODE_ENV: "test",
            PORT: "3001",
          },
        },
        {
          command:
            "pnpm --filter @pila/web build && pnpm --filter @pila/web start",
          url: `${BASE_URL}/`,
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
          stdout: "pipe",
          stderr: "pipe",
          env: {
            NODE_ENV: "test",
            NEXT_PUBLIC_API_BASE_URL: API_BASE_URL,
          },
        },
      ],
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
