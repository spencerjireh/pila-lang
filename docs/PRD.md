# Pila Lang — Product Requirements Document (v1)

## Overview

A multi-tenant SaaS queueing product for restaurants. Guests scan a rotating QR code on-site, join via a web form, and watch their position live until the host calls them. Staff run the queue from a tablet-based host stand. Ships as a web app in v1, self-hosted via Docker Compose. A Flutter native app (guest + host) is the v2 mobile path.

V1 target is a pitch-ready MVP that a sales person can demo to prospective restaurant customers. Target market is Southeast Asia and India, English copy only for the first pass.

## Goals for v1

- A guest can scan, join, and wait in a web browser; no install required
- A host can run the queue for a full shift without training
- The product looks professional enough to close a pitch
- The codebase supports one restaurant now and many restaurants later
- SMS and WhatsApp can be added later with no architectural refactor
- V1 is web-only. A Flutter native app (guest + host) is the v2 mobile path

## Explicitly out of scope for v1

These are deferred by decision and must not creep back in during the build:

- Native mobile apps in v1 — a Flutter native app (guest + host) is the v2 mobile path, explicitly deferred from v1
- Capacitor-wrapped native apps (webview shell) — replaced by Flutter in the v2 plan; not a v1 surface
- PWA install, service worker, offline page, dynamic per-tenant manifests — v1 is browser-only web
- Realtime over WebSocket (SSE instead)
- Wait time estimation shown to the guest
- Guest VIP flags, notes, or tags
- Reservations (separate from walk-in queue)
- Manager-facing analytics or reporting
- Host stand audio alerts on new joins
- Web push notifications (deferred; guests keep the tab open or reopen via cookie/app icon)
- Cross-restaurant guest profiles or shared guest history
- Multi-location support per tenant
- Multiple staff logins per tenant (shared login only)
- Separate manager dashboard (folded into host stand)
- POS integrations
- Billing, pricing, or payment flows
- Full white-label (custom domains, full brand takeover)
- Languages other than English
- Per-tenant usage counters in the admin UI
- Arrival tracking after seating (the app is for queueing only; the guest flow ends at "your table is ready")
- SVG logo uploads (PNG/JPG only in v1; server re-encodes to a normalized PNG)
- Database and blob backups shipped with the product (operator's responsibility; documented but not automated)
- Staging environment (prod only until the first pilot lands)
- Formal WCAG audit (v1 ships a keyboard/aria/contrast baseline only)

Per-restaurant branding is scoped to name, logo, and accent color only.

## Target market

- Geography: Southeast Asia and India
- Restaurant type: fast casual and sit-down casual independents
- Device mix: Android-dominant on the guest side; any browser-capable tablet, phone, or TV for staff
- Language baseline: restaurant staff and most urban guests read English

## Users

**Guest.** Walks in, wants to know when they will be seated. Uses their own phone. Low tolerance for friction. Reads English. Does not want to install anything.

**Host / front-of-house staff.** Runs the queue during a shift. Wants a clear list of who is waiting, how long they have waited, and one-tap actions to seat them. Shared login per restaurant in v1.

**Restaurant owner.** Sets up the restaurant once (name, logo, color). Monitors the queue occasionally. In v1, uses the same host stand UI as staff.

**Internal admin (your team).** Creates tenants manually via `/admin`. Not a customer-facing role.

## Product principles

**Zero install for guests.** The join flow is a web page in the guest's own browser. No install, no download, no account.

**One-tap host actions.** No confirmation dialogs on common host actions. Undo is the safety net.

**Friendly defaults, minimal config.** A new restaurant is productive within five minutes of tenant creation.

**Loud about scope.** Every deferred feature above is flagged as "coming later" in sales conversations. No vaporware.

## Features in scope for v1

### Guest (web)

- QR scan flow with rotating signed token (60-minute window)
- Join form: name (required), party size (required, 1-20), phone (optional, E.164 with country-code picker)
- Wait page showing position, updated in real time via SSE
- Terminal "your table is ready — head to the host" state when the host taps seat; stream closes. No arrival tracking
- "Leave the queue" action with inline confirm; terminal "you've left" state
- Cookie-based session recovery if the guest closes the tab on the same device; the cookie is silently refreshed on each SSE reconnect while the party is still waiting, so a long wait doesn't expire the session
- Returning-guest recognition: same-tenant phone match shows a "welcome back" banner on the wait page (via a short-lived cookie set at join time)
- Error states: tenant closed (hard close), expired QR token, invalid token, after-seated / after-left terminal states, bad form input

### Host stand (web)

- Shared password login per restaurant. Multiple devices may be logged in simultaneously
- Queue list ordered by arrival showing name, party size, time waited (live client-side ticker); updates via SSE
- Below the queue, a collapsible "Recently resolved (last 30 min)" panel shows lately seated/removed parties, each with an inline Undo button while still inside the 60-second window
- "Seat" and "Remove" actions per row (assisted FIFO: no automatic selection, host picks). A 5-second toast with Undo appears on each action
- Undo last action (60-second window). Undo is shared across all sessions for the tenant — any logged-in device can reverse the most recent action, regardless of which device performed it. Undo restores the party to its original `joined_at` position, not the bottom of the queue
- Queue open/closed pill at the top of the queue page. Closing prompts for confirmation; opening does not. Closed behavior is a hard close: new joins blocked, display page shows a "not accepting guests" banner, existing waiters keep their wait page and can still be seated
- Settings: single-page layout with sections for General (name), Branding (logo, accent color with WCAG AA contrast validation), Password (change + "log out all devices"). Logout button lives in the settings footer
- Guest history: past guests grouped by phone with visit count and last visit; infinite scroll
- Silent session refresh within the last hour of the 12h JWT; the host never sees a logout mid-shift. Rotating the shared password immediately invalidates all other active host sessions for this tenant

### Admin tool (internal)

- Magic-link email login for team members on an allow list (env var in v1; DB-backed later)
- Tenant creation: admin picks name, slug (immutable after creation), timezone (IANA typeahead, default `Asia/Kolkata`). Server auto-generates the initial host password and displays it once in the 201 response; the admin copies it and hands it to the restaurant. Slug validation rejects a reserved list (`admin`, `api`, `r`, `host`, `display`, `www`, `public`, `static`, `_next`, `well-known`, `health`)
- Tenant edit: name, logo, accent color, timezone, `is_demo`, `is_open`. Slug is immutable
- Tenant delete: hard-delete only in v1 — force-closes first, then CASCADE wipes parties/notifications in one transaction. No restore window; admins confirm via a typed-slug prompt before the action runs
- Reset demo data and rotate host password are dedicated actions on the tenant detail page
- Full shadcn UI: tenant list + per-tenant detail page
- Demo tenant policy: one shared `demo` tenant. Sales people are added to `ADMIN_EMAILS` and reset it between pitches via `/admin`

### Platform

- Signed rotating QR tokens with a 60-minute window
- Cookie-based guest sessions with 24-hour TTL, silently refreshed on SSE reconnect while waiting
- SSE for guest wait and host queue; Redis pub/sub for broadcast (single app container in v1). Streams send a `:ping` comment every 15 seconds to survive proxy idle timeouts. Terminal-party reconnects receive 204 so the browser stops retrying
- `Notifier` interface wired throughout the code with a no-op implementation in v1 that writes nothing to the notifications table (real notifiers will write `sent`/`failed` rows)
- Rate limiting on join, login, and connection endpoints (Redis-backed). Joins are keyed by phone when one is submitted, else by IP, plus a per-tenant global cap — so a busy restaurant's shared NAT doesn't cap the room

### Packaging

- V1 is a browser-only web app. No PWA manifest, service worker, install prompt, or native wrapper
- If SSE drops on the wait page, an inline "reconnecting" banner appears; stale queue state is never rendered
- Native mobile (guest + host) is the v2 path via a Flutter app against the same API

## User flows

### Guest (web)

Scan QR at restaurant entrance. Join page opens in browser, validating the QR token. Fill name, party size, optional phone. Land on wait page showing position. SSE pushes updates as the queue changes. When the host taps seat, the page transitions to a terminal "your table is ready" state and the stream closes. If the guest closes the tab and reopens the join URL on the same device, the cookie routes them straight back to their wait page.

### Host

Log in to `/host/<slug>` with shared password. See the queue, streaming in real time. Tap seat when a party is ready; tap remove for no-shows. Toggle queue closed at end of shift. Edit name, logo, color in settings. Browse past guests in the guest history tab.

### Admin (internal)

Log in to `/admin` via magic link. Create a new tenant: name, slug, timezone. The server generates the initial host password and shows it once in the response; admin copies it and hands it to the restaurant. Reset demo data between pitches; a reset produces 3 staggered waiting parties and 10 historical seated parties so the queue and history tabs both look populated. Sales people who pitch are added to `ADMIN_EMAILS` so they can trigger the reset themselves.

### QR display

Restaurant owner opens `/display/<slug>` on any screen with a browser. Page shows a large QR code and the restaurant's branding. Every 60 seconds, the page fetches a fresh signed token and re-renders the QR. Screenshots taken more than 65 minutes ago fail validation on the join route. When the queue is closed, the QR is replaced with a "not accepting guests right now" banner.

## Sales demo flow

1. Sales person opens the host stand for the `demo` tenant on their laptop.
2. Opens `/display/demo` in a second tab or on another device.
3. Scans the QR with their phone's browser, demos the full guest join as "Priya Sharma, party of 2."
4. Returns to the laptop and shows the restaurant owner the party appearing in the queue within a second (SSE push).
5. Taps "Seat" on the laptop. Phone updates to "your table is ready" within a second.
6. After the pitch, taps "Reset Demo" to restore the seeded 3-waiting + 10-historical state for the next meeting.

## Deployment requirements for the restaurant

The restaurant must provide:

- A screen at the entrance or host stand with a working browser (tablet, phone, old monitor with a Chromecast, TV with a browser app — any of these)
- A device for the host stand (tablet, laptop, or spare phone) with a modern browser
- Reliable WiFi on the premises

The sales person should have a recommended cheap Android tablet on hand for restaurants that ask "what if we do not have a screen."

## Roadmap beyond v1

Indicative only, in rough priority order:

- SMS or WhatsApp notifier implementation (WhatsApp for Brazil and SEA, SMS for India)
- Flutter native app for guest and host (the v2 mobile path)
- Web push notifications for guests so they can lock their phone while waiting
- Wait time estimation
- Manager-facing analytics (throughput, average wait, no-show rate)
- Party-size-aware queue and lightweight table management
- Reservations as a distinct object from walk-in queue
- Cross-restaurant guest discovery
- Multi-location per tenant
- i18n beyond English
- POS integrations (Toast, Square, and local SEA/India POS)
- Full white-label with custom domains
- Self-serve restaurant signup flow

## "Done" for v1

No external deadline is set. "Done" is defined functionally:

- Sales person can run the end-to-end demo flow in under 5 minutes with zero visible glitches
- Any team member can onboard a new tenant in under 10 minutes
- A guest can join, wait, and be seated without needing help
- Host can run a simulated lunch rush of 20 joins and 20 seats without a bug

A self-imposed target of 4-6 weeks is recommended as a forcing function, even though no external deadline exists.
