import { Router } from "express";

import { clearHostCookieHeader } from "@pila/shared/domain/auth/host-session";

export const hostLogoutRouter = Router();

hostLogoutRouter.post("/host/:slug/logout", (_req, res) => {
  res.setHeader("Set-Cookie", clearHostCookieHeader());
  res.json({ ok: true });
});
