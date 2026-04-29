import { Router } from "express";

import { clearAdminCookieHeader } from "@pila/shared/domain/auth/admin-jwt-cookie";

export const signOutRouter = Router();

signOutRouter.post("/auth/sign-out", (_req, res) => {
  res.setHeader("Set-Cookie", clearAdminCookieHeader());
  res.json({ ok: true });
});
