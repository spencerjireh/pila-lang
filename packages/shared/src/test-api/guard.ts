export function requireTestEnv(): Response | null {
  // Production never sees these routes. `next dev` forces NODE_ENV=development internally,
  // so dev smoke runs opt in via ENABLE_TEST_ROUTES=1. CI/Playwright sets NODE_ENV=test via
  // `pnpm start`, which is honored.
  if (process.env.NODE_ENV === "test") return null;
  if (process.env.ENABLE_TEST_ROUTES === "1") return null;
  return new Response("Not found", { status: 404 });
}
