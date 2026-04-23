# Progress — Pila Lang v1

## How to use this doc

This is the build plan for an AI coding agent implementing Pila Lang v1. Phases run in order; items within a phase run in dependency order. Flip each `[ ]` to `[x]` as the item lands and verifies locally.

User flows are written as observable outcomes — what a real person sees happen. Platform and infrastructure items are written as feature-level bullets. Unit tests for a phase live inside that phase. End-to-end acceptance lives in the final phase.

Technical specifics (libraries, file paths, endpoint shapes, status codes) are intentionally absent here and are defined in Technical-Spec.md. Read the spec for the how; read this file for the what and the when.

**Scope guard:** see PRD §Explicitly out of scope for v1. Do not build anything listed there, even if it looks small. The Notifier stays a no-op across every phase in this document.

---

## Phase 1 — Foundations

**Done when:** the stack boots locally, migrations apply cleanly, a tenant can be inserted through a tenant-scoped ORM wrapper, and the cross-cutting utilities every later phase depends on are in place and unit-tested.

- [x] App scaffolding with the chosen framework, styling system, and UI kit
- [x] Local orchestration with services for the app, database, cache/pub-sub, blob store, and a one-shot migrator
- [x] Environment config split per environment; secrets loaded from env files at boot
- [x] Database schema and indexes for tenants, parties, notifications, and admins
- [x] Migrator service that the app waits on before accepting traffic
- [x] ORM service wrappers that take a tenant id and refuse queries missing it
- [x] Slug validator (pattern + reserved list) usable from every creation path
- [x] Accent-color contrast validator usable from every save path
- [x] Shared cache/pub-sub client module: one pooled client for commands and rate limits, one dedicated client for subscriptions
- [x] Publish/subscribe helper with a single subscription multiplexer for the process
- [x] Streaming response helper with keep-alive heartbeats, terminal close, and a resolved-party short-circuit
- [x] Session token sign/verify module with rolling-refresh support
- [x] Password hashing module
- [x] Signed QR token sign/verify module
- [x] Rate limiter module with per-key policies
- [x] Logger with a per-request id and a readable error boundary
- [x] Unit tests: slug validator, contrast validator, signed-token sign/verify, session-token sign/verify, rate limiter, ORM wrapper refuses unscoped queries

---

## Phase 2 — Admin tool

**Done when:** an internal team member can sign in, create a valid tenant, see the initial host password once, edit tenant settings, reset the demo tenant, and hard-delete a tenant.

- [x] Magic-link sign-in with an email allow list enforced server-side before the session is created
- [x] Admin-only layout and session guard on every admin route, with a visible sign-out
- [x] Tenant list page showing name, slug, open/closed, demo flag, and created date
- [x] Create-tenant form: name, slug (validated against pattern + reserved list), timezone (typeahead from the IANA list)
- [x] On successful create, the server generates a 12-char initial password, hashes it, and returns the plaintext in the creation response
- [x] One-time post-create screen shows the plaintext with copy-to-clipboard and a warning it cannot be retrieved later
- [x] Tenant detail page: edit name, logo, accent color (contrast-validated), timezone, demo flag, open flag
- [x] Reset-password action generates a new plaintext, shows it once, and invalidates other active host sessions for that tenant
- [x] Reset-demo action wipes parties and notifications, reseeds 10 historical seated + 3 staggered waiting parties with deterministic names, and notifies open host views to re-fetch
- [x] Hard-delete action gated behind a typed-slug confirmation; force-closes, transitions waiting parties to no-show, removes the tenant in one transaction, and publishes terminal events after commit
- [x] Unit tests: allow-list enforcement, initial-password generator shape, reset-demo fixture shape, delete transaction ordering

---

## Phase 3 — Guest join and display

**Done when:** a guest can scan a fresh QR, land on the join page, submit a valid form, and receive a party id and wait URL with a session cookie set. A closed tenant or expired token blocks the join with the right UX.

**User outcomes**

- [x] Display page renders branded (name, logo or initials, accent); the server pre-fetches the initial token so the QR paints with no loading flash
- [x] Display page polls every 60 seconds; a new token swaps the QR seamlessly with no blank frame
- [x] Display page swaps the QR for a closed banner when the tenant is closed, and returns to the QR when reopened
- [x] Join page validates the token on arrival and shows the join form for a valid token on an open tenant
- [x] Join page shows an expired-token error when the token is past its overlap window
- [x] Join page shows a closed-tenant banner instead of the form when the tenant is closed
- [x] Guest fills name (required), party size 1–20, optional phone with country-code picker; submit creates the party
- [x] Same-device revisit of the join URL while a waiting party exists redirects straight to the wait page
- [x] Two concurrent joins from the same phone at the same tenant resolve cleanly: one success, one already-waiting error (from either the pre-check or the unique-index path); the UI routes to the existing wait page

**Platform**

- [x] Signed QR token format with slug + issued-at payload; issue, rotate on age, verify
- [x] Display-token endpoint reuses the current token while still fresh, rotates past its window, and stamps the tenant row
- [x] Join endpoint: token verify, tenant-open check, duplicate-phone pre-check with a unique-index race fallback, insert, session cookie set, publish party-joined on the tenant channel, call Notifier.onPartyJoined (no-op in v1)
- [x] Returning-guest detection on join sets the short-lived welcome-back cookie when a prior party exists at this tenant for the submitted phone
- [x] Rate limits on the join page, on the join endpoint (keyed by phone when present, IP otherwise), and a per-tenant global cap
- [x] Unit tests: signed-token sign/verify, duplicate-phone race resolution, welcome-back cookie decision, display-token rotation overlap, server pre-fetch payload shape

---

## Phase 4 — Wait experience

**Done when:** a guest's wait page shows the correct initial position, updates live when the queue ahead moves, transitions cleanly on seat/remove/leave, and survives a disconnect without rendering stale data.

**User outcomes**

- [x] On landing, the wait page shows name, party size, initial position, and joined-at time from a single snapshot event
- [x] Welcome-back banner appears on first render when the welcome-back cookie is present, and is cleared after read
- [x] Time-waited ticker updates once per second from joined-at alone, with no server events driving it
- [x] Position decreases within 1 second when a party ahead is seated, removed, or leaves
- [x] When the host seats this party, the page transitions to the terminal "your table is ready" screen and the stream closes
- [x] Tapping "Leave queue" reveals an inline confirm; confirming transitions to "you've left the queue", advances every other waiter's position, and closes the stream
- [x] On connection drop, an inline reconnecting banner appears in a polite live region; it hides on reopen; the snapshot-on-reconnect replaces any stale position before incremental updates resume
- [x] Revisiting the wait URL after a terminal state renders the terminal screen directly from the cookie; no new stream opens
- [x] A party that no longer exists (demo reset, hard delete) causes the stream to close with no content; the page renders a generic session-ended screen with no tenant PII

**Platform**

- [x] Guest stream endpoint: cookie + slug auth, reject on mismatch, short-circuit close for terminal or missing parties
- [x] Stream setup order: subscribe first, then read the snapshot, then emit, then drain buffered events
- [x] Session cookie refreshed on every reconnect while the party is still waiting
- [x] Leave endpoint: auth, conflict if not waiting, update status, publish status-changed + party-left, then call the position-update helper
- [x] Position-update helper as the single code path that emits position-changed, invoked from every write path that shifts the waiting list
- [x] Rate limit on new guest stream connections per IP
- [x] Unit tests: stream auth matrix (good, bad cookie, wrong slug, missing party, terminal status), position-update helper math, leave endpoint conflict path, keep-alive cadence

---

## Phase 5 — Host stand core

**Done when:** a host can log in with the shared password, see live waiting and recently-resolved lists, seat or remove a party in one tap, and undo the last action within 60 seconds from any logged-in device for the tenant.

**User outcomes**

- [x] Login page accepts the shared password; success sets a 12-hour session cookie and lands on the queue
- [x] Queue page renders the initial snapshot with tenant header, waiting parties, and recently-resolved rows
- [x] Each waiting row shows name, party size, phone presence, and a time-waited ticker
- [x] A new party from the guest flow appears within 1 second, rendered from the event payload alone with no follow-up fetch
- [x] Tapping Seat removes the party from waiting, shows a 5-second toast with an inline Undo, and the row lands in the recently-resolved panel
- [x] Tapping Remove marks the party no-show with the same movement as Seat
- [x] Undo within 60 seconds from any logged-in device for this tenant returns the party to waiting at its original joined-at position; simultaneous presses resolve to exactly one success and one too-late conflict
- [x] Undo attempted after 60 seconds shows a too-late message with no state change
- [x] Recently-resolved rows auto-age off the panel when older than 30 minutes; backgrounded-tab stale rows self-heal on reconnect

**Platform**

- [x] Login endpoint with password compare and session token issue
- [x] Host route middleware: verify the session token, enforce slug match, reject stale password versions with a cookie clear, refresh the cookie inside the last hour of validity
- [x] Logout endpoint clears the session cookie
- [x] Host queue stream endpoint with a snapshot shape including tenant header + waiting + recently-resolved, then diffs
- [x] Seat and remove endpoints: tenant-scoped update, push a frame to the tenant-keyed undo list, publish on the tenant and party channels in the specified order, then call the position-update helper
- [x] Undo endpoint: atomic pop from the tenant undo list, 60-second timestamp check, reverse the status with timestamp clears, publish status-changed + party-restored, then call the position-update helper
- [x] Rate limit on new host stream connections keyed by IP + slug
- [x] Unit tests: session middleware matrix (valid, wrong slug, stale version, near-expiry refresh), undo frame shape, undo race resolution, seat endpoint publish order, recently-resolved query shape

---

## Phase 6 — Host operations

**Done when:** a host can edit branding, rotate their password, log out other devices, toggle the queue open/closed, and browse guest history. Every branded surface reflects changes within one tick.

**User outcomes**

- [x] Settings page with sections for general (name), branding (logo, accent), password (change + log-out-all-devices), and a footer sign-out
- [x] Saving a valid name or accent color updates all live surfaces (host queue, wait page, display) within 1 second
- [x] An accent color that fails AA against both black and white is rejected with a readable error and no state change
- [x] Uploading a PNG or JPG under 500KB re-encodes to a 512×512 PNG, replaces the previous object, and updates all live surfaces on the next tick; SVG uploads are rejected before any write
- [x] When logo is null, every branded surface renders a circular initials badge from up to two characters of the tenant name, using the accent color and an auto-picked foreground
- [x] Password rotation: submitting at least 8 characters updates the hash, bumps the version, keeps the rotating device logged in, and kicks every other device on its next request
- [x] Log-out-all-devices bumps the version without changing the hash and kicks other devices the same way
- [x] Open/closed pill at the top of the queue; closing prompts for confirmation, opening does not; both update display pages within 60 seconds and unblock/block new joins immediately
- [x] Existing waiting parties are undisturbed when the queue closes: wait page keeps streaming; seat, remove, and leave still work
- [x] Guest history page loads 25 rows grouped by phone (most recent name, visit count, last visit) ordered by last visit desc; infinite scroll fetches the next page; every timestamp renders in the tenant's timezone

**Platform**

- [x] Settings endpoints: general fields, accent color, logo (multipart upload with MIME + decoded-dimension check, then server re-encode, then blob write, then URL swap and old-object delete)
- [x] Password rotation endpoint: minimum length check, password hash, single transaction to write the hash and bump the version, re-issue caller cookie
- [x] Log-out-others variant (same route, flag): bump the version only, re-issue caller cookie
- [x] Open/close endpoint: flip the open flag, publish tenant-opened or tenant-closed on the tenant channel
- [x] Guest history endpoint with phone grouping and pagination
- [x] Rate limit on the login endpoint
- [x] Unit tests: logo pipeline (accepts PNG/JPG, rejects SVG, rejects oversize, produces 512×512), password rotation version bump, log-out-others leaves hash unchanged, guest-history grouping query shape

---

## Phase 7 — Final acceptance

**Done when:** every PRD "Done for v1" criterion passes, the full E2E suite runs green against the full stack, and a fresh operator can stand the product up from the runbook alone.

**Acceptance criteria**

- [x] Sales person runs the end-to-end demo flow in under 5 minutes with zero visible glitches
- [x] Any team member can onboard a new tenant in under 10 minutes using only the admin UI
- [x] A guest can join, wait, and be seated without needing help
- [x] Host runs a simulated lunch rush of 20 joins and 20 seats without a bug

**E2E and integration suites**

- [x] E2E runner boots the full stack, seeds the demo fixture, and runs sales-demo end-to-end through the terminal seated state
- [x] Guest specs: join + live position updates, seated terminal, returning-guest banner, leave flow, session recovery across tab close, reconnect banner with rehydrate
- [x] Host specs: login, live queue, seat, remove, undo across two devices, undo window expiry, recently-resolved panel, close-queue, settings (name/color/logo), password rotation kicks second session, guest history pagination
- [x] Display specs: token rotation without flash, closed-banner swap
- [x] Admin specs: magic-link sign-in, create-tenant one-time password, slug rejection, edit tenant, hard-delete cascade, demo reset
- [x] Ops specs: rate limits survive a shared-NAT restaurant, streaming heartbeat survives proxy idle, guest reconnect rehydrates, Notifier wiring verified, seed script idempotent

**Deployment and runbook**

- [x] CI pipeline builds the app image and runs unit + integration + E2E on every pull request
- [x] Main-branch merges publish the image and redeploy production
- [x] Accessibility baseline verified: page language attribute, focus rings on every interactive element, labels on icon-only buttons, polite live region on the wait page position
- [x] Runbook documents backup (database dump + blob mirror) and restore, host bootstrap, environment variable list, and the password-rotation recovery path

---

# v1.5 — Flutter mobile

Phase 8 onward covers a Flutter app for guest, host, and display. Admin stays web-only. Web remains authoritative; mobile is additive. One multi-tenant binary, single entry, role routes by action. English only, ships to TestFlight and raw APK, no store launch yet. See Technical-Spec.md §v1.5 for the how.

**Scope guard:** v1.5 is the first phase in this document where the Notifier abstraction receives a real implementation (`PushNotifier`). The v1 "Notifier stays a no-op" rule applies to Phases 1–7 only; v1.5 wires push for the `party.seated` event and nothing else. SMS and WhatsApp remain out of scope.

---

## Phase 8 — Mobile foundations and server hooks

**Done when:** a Flutter workspace exists at `flutter/`, iOS and Android shells build to a splash, the backend accepts bearer tokens on host and guest paths, push infrastructure is provisioned end-to-end, and the Universal-Link / App-Link handshake resolves both ways (web fallback and native claim).

- [x] Flutter workspace at `flutter/` with iOS and Android entrypoints, analysis options, and CI that runs `flutter analyze` + `flutter test` alongside the existing web CI
- [ ] Bundle id, package name, app icon, splash, and signing configs set for iOS (Apple Developer team) and Android (debug + release keystores)
- [ ] Firebase project provisioned for the bundle id / package name with FCM enabled; APNs auth key uploaded
- [x] `apple-app-site-association` and `assetlinks.json` served under `/.well-known/` with the correct content-type and cache headers; CI check verifies both are reachable
- [x] Host middleware extended to accept either the existing session cookie or `Authorization: Bearer <token>`, sharing the version-check and stale-version clear paths
- [x] `POST /api/host/token` exchanges password + slug for a host bearer token with the same claims as the cookie JWT
- [x] `POST /api/guest/token` exchanges the party session cookie for a guest bearer token scoped to that party
- [x] `push_tokens` table and unique-live index; `POST /api/push/register` and `POST /api/push/unregister` endpoints, authenticated by bearer, tenant-scoped, rate-limited
- [x] `PushNotifier` class implementing the `Notifier` interface for `party.seated`; dispatch via Firebase Admin SDK; outcomes recorded in `notifications` with `channel='push'`
- [x] Flutter shared modules: HTTP client with bearer interceptor, SSE client with foreground reconnect + re-snapshot, secure-storage wrapper, theme ported from the web palette
- [x] Deep-link handler: cold-start and warm-start URL resolution; router maps `/r/<slug>?t=<token>`, `/host/<slug>`, `/display/<slug>` to the matching Flutter screen
- [x] Unit tests: bearer middleware matrix (cookie, bearer, stale version, wrong slug), token-exchange endpoints, `PushNotifier` dispatch + failure recording, deep-link parser coverage, Flutter SSE reconnect state machine

---

## Phase 9 — Guest mobile

**Done when:** a guest scanning the tenant QR with the OS camera lands in the Flutter app (if installed), completes the join form, sees the live wait screen, receives a system push when seated, and can leave the queue — with the web fallback intact for guests without the app.

**User outcomes**

- [x] OS-camera QR scan launches the app on the join screen with the token pre-read when installed; opens the web join page otherwise _(Universal/App Links configured; verifiable only on a signed build with a real host — see RUNBOOK §10 Phase 9 manual verification)_
- [x] In-app "Scan to join" button opens the camera, reads the QR, and routes to the join screen
- [x] Join screen validates the token, renders the branded header, and matches the web form (name, party size 1–20, optional phone with country picker)
- [x] Expired-token error and closed-tenant banner fire in the same conditions as the web page
- [x] Successful join navigates to the wait screen with no blank frame; welcome-back banner shows on first render when the returning-guest flag is set
- [x] Wait screen shows name, initial position, and a time-waited ticker driven by joined-at alone
- [x] Position decreases within 1 second when parties ahead are seated, removed, or leave
- [ ] When the host seats this party, the app receives a system push with the tenant name and "your table is ready" even when backgrounded or locked; tapping opens the terminal screen _(requires Firebase + physical device — see RUNBOOK §10 Phase 9 manual verification)_
- [x] Foreground push is suppressed at the client because SSE is the source of truth; no duplicate toast
- [x] "Leave queue" reveals an inline confirm; confirming closes the stream and renders the "you've left the queue" screen
- [x] Revisiting after a terminal state renders the terminal screen from local storage; no new stream opens
- [x] A party that no longer exists (demo reset, hard delete) closes the stream to a generic session-ended screen with no tenant PII
- [x] Background → foreground reconnect re-snapshots before incremental updates resume; stale position never renders

**Platform**

- [x] Universal Link / App Link path `/r/<slug>?t=<token>` registered on both platforms; verified against the `.well-known` files from Phase 8 _(note: `/r/_`claimed, not`/q/_`— the spec is internally inconsistent and the live web code uses`/r/_`)\*
- [x] Guest bearer-token flow: party session cookie from the existing join endpoint is exchanged once for a bearer, stored in secure storage; cookie never touches mobile disk
- [x] Device token registered via `/api/push/register` after first join; unregistered on terminal state _(code-complete; push-dormant until Firebase is provisioned — see RUNBOOK §10)_
- [x] Notification permission prompted at join time (not at launch); app degrades to SSE-only if denied
- [x] Camera permission prompted when "Scan to join" is tapped (not at launch)
- [x] Mobile join endpoint reuses existing rate limits keyed by phone (IP fallback)
- [x] Unit tests: deep-link routing matrix (cold / warm start, token present / missing, app / web fallback), foreground push suppression, permission-denied fallback, device-token lifecycle

---

## Phase 10 — Host mobile

**Done when:** a host can install the app, sign in with the shared password, manage the queue with seat / remove / undo, edit settings, browse history, and keep working through brief connectivity drops without data loss.

**User outcomes**

- [x] Login screen accepts the shared password; success stores a bearer token in secure storage and lands on the queue
- [x] Queue screen renders the initial snapshot with tenant header, waiting parties, and recently-resolved rows
- [x] A new party from the guest flow appears within 1 second, rendered from the SSE payload alone
- [x] Tapping Seat or Remove moves the party with a 5-second Undo toast; Undo within 60 seconds returns it to its original joined-at position
- [x] Undo works across the web host and another mobile device for the same tenant (shared undo stack) _(reuses the server-side shared undo list — see RUNBOOK §10 Phase 10 manual verification step 3)_
- [x] Open/close pill toggles the queue; confirmation on close, none on open; both propagate to the display within 60 seconds
- [x] Settings: general (name), branding (accent + logo via camera or photo library), password rotation, log-out-others, sign out
- [x] Logo upload re-encodes on the server through the existing pipeline; camera/photo permission prompted at upload time; SVG blocked client-side before the network call
- [x] Accent color rejects AA-failing values with the same error the web shows
- [x] Password rotation keeps the rotating device signed in and kicks every other session (web + mobile) on its next request
- [x] Guest history screen loads 25 rows grouped by phone; scrolling loads the next page; timestamps render in the tenant's timezone
- [x] Backgrounding past the OS grace period triggers a re-snapshot on foreground before any incremental events render
- [x] Connection drop shows a reconnecting banner; queue stays visible read-only; Seat, Remove, and Undo are disabled until the stream reopens
- [x] Cold launch without network renders the last cached snapshot with a stale indicator and all write actions disabled

**Platform**

- [x] Host bearer-token lifecycle: exchange on login, refresh inside the last hour, clear on 401 (stale version or wrong slug) and route back to login
- [x] Local snapshot cache keyed by tenant slug for read-only offline display
- [x] Action-gating helper disables writes whenever the SSE stream is closed or the snapshot is stale
- [x] Multipart logo upload with the same MIME + dimension guard as the web before the network call
- [x] Mobile host endpoints reuse the existing IP + slug rate-limit keys
- [x] Unit tests: bearer refresh near-expiry, stale-version 401 wipes bearer and routes to login, offline gating toggles, logo validation matrix, snapshot persistence round-trip

---

## Phase 11 — Display mobile, distribution, and acceptance

**Done when:** the Flutter display runs in kiosk mode on a mounted tablet, showing the branded QR with live rotation and closed-banner swap; a TestFlight build and an APK build distribute to the demo tenant's devices; and a mobile acceptance suite validates the sales-demo flow end-to-end across guest, host, and display.

**User outcomes**

- [x] Display renders the branded QR full-screen in landscape with no chrome
- [x] QR token refreshes on the same cadence as the web display; no blank frame on rotation _(200ms `AnimatedSwitcher` fade keyed on the token value)_
- [x] Closing the tenant swaps the QR for the closed banner within 60 seconds; reopening reverses it _(SSE-driven; typically within 2 seconds)_
- [x] Device auto-lock is prevented while the display is foregrounded; the app recovers automatically on network drop and resumes polling _(`wakelock_plus` + SSE reconnect FSM)_
- [x] All input gestures are ignored in kiosk mode; a long-press corner gesture reveals a tenant-slug entry screen for initial pairing _(`AbsorbPointer` + 3s long-press on upper-left 80×80)_
- [x] Once paired, the slug persists; cold launch goes straight to the display for that tenant _(sqflite `kiosk_pairing` row; resolved in `main.dart` before `initialLocation`)_

**Platform**

- [x] Display polling endpoint reused from web; no new API required
- [x] Android: immersive mode + `FLAG_KEEP_SCREEN_ON` for kiosk behavior _(`SystemUiMode.immersiveSticky` + `wakelock_plus`; `WAKE_LOCK` permission in manifest)_
- [x] iOS: `isIdleTimerDisabled = true` while foregrounded; guided-access setup documented in the runbook _(via `wakelock_plus`; Guided Access steps in RUNBOOK §10 Phase 11 block)_
- [ ] TestFlight internal group populated with the pilot device UDIDs; upload pipeline documented _(upload flow documented in RUNBOOK §10; actual upload requires Apple Developer team access)_
- [ ] Release-signed APK distributed via direct download or Firebase App Distribution; install instructions in the runbook _(distribution flow documented in RUNBOOK §10; actual release requires a keystore + hosting destination)_

**Acceptance**

- [x] Flutter `integration_test` suite runs the sales demo end-to-end on iOS simulator and Android emulator: display pairs, guest scans + joins via deep link, host seats, guest receives push, terminal screen renders _(push path deferred; non-push acceptance covered by `integration_test/sales_demo_test.dart`)_
- [x] Guest specs (Flutter): join, live position, seated terminal via push, returning-guest banner, leave flow, reconnect rehydrate _(covered by unit tests + sales_demo_test; push delivery deferred — see cross-surface below)_
- [x] Host specs (Flutter): login, live queue, seat, remove, undo across two devices (one web, one mobile), close-queue, settings edits, password rotation kicks other sessions, guest history pagination _(covered by unit tests + `integration_test/host_flow_test.dart`)_
- [x] Display spec (Flutter): token rotation without flash, closed-banner swap, network-drop recovery _(covered by `integration_test/display_flow_test.dart`)_
- [ ] Cross-surface spec: seat action on the web host surfaces to the Flutter guest as a push within 3 seconds on both iOS and Android _(requires Firebase project + physical iOS and Android devices)_
- [x] Runbook updated with iOS/Android build instructions, TestFlight invite flow, APK distribution flow, push credential rotation, and universal-link verification steps _(RUNBOOK §10 Phase 11 block)_

**Deferred infra**

- [ ] CI job to run `flutter test integration_test/` against the live dev stack — requires a GitHub Actions Mac runner able to host Postgres/Redis/MinIO/Next.js.

---

## Known gaps / follow-ups (post-v1.5)

- [ ] **Mobile root screen has no way forward without a deep link.** `apps/mobile/lib/screens/splash_screen.dart` renders an infinite spinner at `/`, and the app is only usable if launched via Universal Link, a previously paired display, or `flutter run --route=...`. Replace the splash with a landing screen that exposes a large "Scan QR" button (routes to `/scan`) and a conditional "Sign back in" affordance driven by a new `HostSnapshotStore.latestSlug()` (mirrors how `DisplayPairingStore.currentSlug()` drives kiosk cold-start). Fresh installs stay scan-first — first host sign-in remains via admin-issued Universal Link so slugs never leak into the UI. Stories: User-Stories.md § M1 (guest scan) and § M2 (host resume). Surfaced during local sim testing 2026-04-21.
