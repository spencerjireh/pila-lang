# `/api/test/*` routes

Every handler in this folder is gated by `requireTestEnv()`
(`packages/shared/src/test-api/guard.ts`), which 404s unless
`NODE_ENV === "test"` **or** `ENABLE_TEST_ROUTES=1` is set.

- **Dev:** neither flag is set by default; these routes 404 for safety.
- **CI:** `.github/workflows/ci.yml` sets `ENABLE_TEST_ROUTES=1` because
  `next start` forces `NODE_ENV=production` at runtime.
- **Prod:** `ENABLE_TEST_ROUTES` is never set; routes stay 404.

Do not add routes here without calling `requireTestEnv()` at the top of the
handler. If you are tempted to use these for production debugging, add a
real admin endpoint instead.

The folder is intentionally NOT `_test/` — Next's underscore convention
removes the folder from the route tree entirely, which would break the e2e
suite and the Flutter integration tests that depend on `/api/test/*`.
