import { Router } from "express";

import { signQrToken } from "@pila/shared/primitives/qr/token";

import { param } from "../../lib/params.js";

export const testQrTokenRouter = Router();

testQrTokenRouter.get("/test/qr-token/:slug", (req, res) => {
  const slug = param(req, "slug");
  if (!slug) {
    res.status(404).json({ error: "not_found" });
    return;
  }
  const issuedAtMs = Date.now();
  const token = signQrToken(slug, issuedAtMs);
  res.json({ slug, token, issuedAtMs });
});
