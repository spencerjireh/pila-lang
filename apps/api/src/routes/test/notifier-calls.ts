import { Router } from "express";

import { testSpyNotifier } from "@pila/shared/domain/notifier/index";

export const testNotifierCallsRouter = Router();

// Set the no-store header so reverse proxies don't cache between drain()
// calls. (The original Next route used `export const dynamic = "force-dynamic"`
// for the same reason.)
testNotifierCallsRouter.get("/test/notifier/calls", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const spy = testSpyNotifier();
  if (!spy) {
    res.json({ calls: [], note: "notifier is not a TestSpyNotifier" });
    return;
  }
  res.json({ calls: spy.drain() });
});
