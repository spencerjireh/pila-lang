import { Router } from "express";

import { adminResetDemoRouter } from "./admin/reset-demo.js";
import { adminResetPasswordRouter } from "./admin/reset-password.js";
import { adminTenantByIdRouter } from "./admin/tenant-by-id.js";
import { adminTenantsRouter } from "./admin/tenants.js";
import { callbackRouter } from "./auth/callback.js";
import { magicLinkRouter } from "./auth/magic-link.js";
import { signOutRouter } from "./auth/sign-out.js";
import { displayStreamRouter } from "./display/stream.js";
import { healthRouter } from "./health.js";
import { hostQueueStreamRouter } from "./host/queue-stream.js";
import { partyStreamRouter } from "./r/party-stream.js";

/**
 * The single v1 router. All sub-routers mount here; the app mounts this
 * under `/api/v1`. New surfaces (host actions, r join/leave, push, test)
 * land in subsequent sprints.
 */
export const v1Router = Router();

v1Router.use(healthRouter);
v1Router.use(magicLinkRouter);
v1Router.use(callbackRouter);
v1Router.use(signOutRouter);
v1Router.use(hostQueueStreamRouter);
v1Router.use(partyStreamRouter);
v1Router.use(displayStreamRouter);
v1Router.use(adminTenantsRouter);
// `/admin/tenants/:id/reset-password` and `/admin/tenants/:id/reset-demo`
// must mount BEFORE `/admin/tenants/:id` so the more specific path wins.
v1Router.use(adminResetPasswordRouter);
v1Router.use(adminResetDemoRouter);
v1Router.use(adminTenantByIdRouter);
