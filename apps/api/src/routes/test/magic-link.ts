import { Router } from "express";

import { latestMagicLink } from "@pila/shared/domain/auth/test-magic-link-store";

import { asyncHandler } from "../../lib/async-handler.js";

export const testMagicLinkRouter = Router();

testMagicLinkRouter.get(
  "/test/magic-link",
  asyncHandler(async (req, res) => {
    const email =
      typeof req.query.email === "string"
        ? req.query.email.trim().toLowerCase()
        : "";
    if (!email) {
      res.status(400).json({ error: "missing_email" });
      return;
    }
    const entry = latestMagicLink(email);
    if (!entry) {
      res.status(404).json({ error: "no_token" });
      return;
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({ url: entry.url, at: entry.at });
  }),
);
