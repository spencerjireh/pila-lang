import { Router } from "express";

import { testSpyNotifier } from "@pila/shared/domain/notifier";

export const testNotifierCallsRouter = Router();

// `force-dynamic` in Next is replaced by the no-cache middleware below —
// Express never caches handler responses, but we set the explicit header
// so reverse proxies don't either.
testNotifierCallsRouter.get("/test/notifier/calls", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const spy = testSpyNotifier();
  if (!spy) {
    res.json({ calls: [], note: "notifier is not a TestSpyNotifier" });
    return;
  }
  res.json({ calls: spy.drain() });
});
