import { Router } from "express";

import { testEnvGuard } from "../middleware/test-env-guard.js";

import { adminResetDemoRouter } from "./admin/reset-demo.js";
import { adminResetPasswordRouter } from "./admin/reset-password.js";
import { adminTenantByIdRouter } from "./admin/tenant-by-id.js";
import { adminTenantsRouter } from "./admin/tenants.js";
import { callbackRouter } from "./auth/callback.js";
import { magicLinkRouter } from "./auth/magic-link.js";
import { signOutRouter } from "./auth/sign-out.js";
import { displayStreamRouter } from "./display/stream.js";
import { displayTokenRouter } from "./display/token.js";
import { guestTokenRouter } from "./guest/token.js";
import { healthRouter } from "./health.js";
import { hostGuestsRouter } from "./host/guests.js";
import { hostLoginRouter } from "./host/login.js";
import { hostLogoutRouter } from "./host/logout.js";
import { hostOpenCloseRouter } from "./host/open-close.js";
import { hostPartiesActionsRouter } from "./host/parties-actions.js";
import { hostQueueStreamRouter } from "./host/queue-stream.js";
import { hostSettingsGeneralRouter } from "./host/settings-general.js";
import { hostSettingsLogoRouter } from "./host/settings-logo.js";
import { hostSettingsPasswordRouter } from "./host/settings-password.js";
import { hostTokenRouter } from "./host/token.js";
import { hostUndoRouter } from "./host/undo.js";
import { pushRegisterRouter } from "./push/register.js";
import { pushUnregisterRouter } from "./push/unregister.js";
import { rInfoRouter } from "./r/info.js";
import { rJoinRouter } from "./r/join.js";
import { rLeaveRouter } from "./r/leave.js";
import { partyStreamRouter } from "./r/party-stream.js";
import { testFlushRedisRouter } from "./test/flush-redis.js";
import { testMagicLinkRouter } from "./test/magic-link.js";
import { testNotifierCallsRouter } from "./test/notifier-calls.js";
import { testPartyStateRouter } from "./test/party-state.js";
import { testQrTokenRouter } from "./test/qr-token.js";
import { testResetTenantRouter } from "./test/reset-tenant.js";
import { testSetupTenantRouter } from "./test/setup-tenant.js";
import { testSignInAsAdminRouter } from "./test/sign-in-as-admin.js";

/**
 * The single v1 router. The app mounts this under `/api/v1`.
 *
 * Order matters where parameter overlap exists:
 *   - admin reset-* (specific) before admin tenant-by-id (catch-all)
 *   - host token (POST /host/token) before any /host/:slug route
 */
export const v1Router = Router();

// Foundation
v1Router.use(healthRouter);

// Auth (admin magic-link)
v1Router.use(magicLinkRouter);
v1Router.use(callbackRouter);
v1Router.use(signOutRouter);

// Host token before any /host/:slug routes so :slug doesn't match "token"
v1Router.use(hostTokenRouter);

// Host
v1Router.use(hostLoginRouter);
v1Router.use(hostLogoutRouter);
v1Router.use(hostOpenCloseRouter);
v1Router.use(hostGuestsRouter);
v1Router.use(hostUndoRouter);
v1Router.use(hostPartiesActionsRouter);
v1Router.use(hostSettingsGeneralRouter);
v1Router.use(hostSettingsPasswordRouter);
v1Router.use(hostSettingsLogoRouter);
v1Router.use(hostQueueStreamRouter);

// Guest / public
v1Router.use(rInfoRouter);
v1Router.use(rJoinRouter);
v1Router.use(rLeaveRouter);
v1Router.use(partyStreamRouter);
v1Router.use(guestTokenRouter);

// Display
v1Router.use(displayTokenRouter);
v1Router.use(displayStreamRouter);

// Push
v1Router.use(pushRegisterRouter);
v1Router.use(pushUnregisterRouter);

// Admin (specific paths before catch-all)
v1Router.use(adminTenantsRouter);
v1Router.use(adminResetPasswordRouter);
v1Router.use(adminResetDemoRouter);
v1Router.use(adminTenantByIdRouter);

// Test fixtures — gated on NODE_ENV=test or ENABLE_TEST_ROUTES=1.
const testRouter = Router();
testRouter.use(testEnvGuard);
testRouter.use(testSetupTenantRouter);
testRouter.use(testResetTenantRouter);
testRouter.use(testSignInAsAdminRouter);
testRouter.use(testMagicLinkRouter);
testRouter.use(testFlushRedisRouter);
testRouter.use(testPartyStateRouter);
testRouter.use(testQrTokenRouter);
testRouter.use(testNotifierCallsRouter);
v1Router.use(testRouter);
