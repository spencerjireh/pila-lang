# Pila Lang v1 — Operations Runbook

Audience: an SRE or ops engineer standing the product up on a fresh host, keeping it running, and recovering from common failures. No code reading required.

---

## 1. Architecture at a glance

Four services, one network:

| Service    | Image                             | Role                                                                             |
| ---------- | --------------------------------- | -------------------------------------------------------------------------------- |
| `app`      | `ghcr.io/<owner>/pila-lang:<tag>` | Next.js server on port 3000. Serves the UI, REST + SSE APIs.                     |
| `postgres` | `postgres:16-alpine`              | Source of truth for tenants, parties, notifications, admin sessions.             |
| `redis`    | `redis:7-alpine`                  | Pub/sub channel per tenant + per party, per-key rate limits, undo buffer.        |
| `minio`    | `minio/minio:latest`              | S3-compatible blob store for tenant logos. Swap for AWS S3 in prod if preferred. |
| `migrator` | `node:22-alpine`                  | One-shot Drizzle migration runner. `app` waits on it.                            |

The `app` container is stateless — scale horizontally by starting more copies behind a shared-nothing load balancer (sticky sessions not required).

---

## 2. Host bootstrap — from bare Linux to serving traffic

```bash
# 1. Install docker + compose plugin (Debian/Ubuntu shown).
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# 2. Clone the repo.
git clone https://github.com/<owner>/pila-lang.git /srv/pila-lang
cd /srv/pila-lang

# 3. Populate .env.prod from the template. Replace every "change_me" value.
cp .env.example .env.prod
$EDITOR .env.prod

# 4. Pull the published image and bring the stack up.
export PILA_LANG_IMAGE=ghcr.io/<owner>/pila-lang:latest
docker compose --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml pull app
docker compose --env-file .env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml up -d

# 5. Verify health.
curl -fsS http://localhost:3000/api/health
# => {"ok":true}
```

Create the first tenant via the admin UI:

1. Open `https://<host>/admin` in a browser whose email is on `ADMIN_EMAILS`.
2. Enter the email, submit, open the magic link from the inbox.
3. Click **Create tenant**, fill out name/slug/timezone, submit.
4. **Copy the one-time password** displayed to the screen. It is never shown again.
5. Hand the password to the on-site manager. They sign in at `https://<host>/host/<slug>`.

---

## 3. Environment reference

Every variable is required unless noted. `lib/config/env.ts` is the source of truth.

| Variable             | Secret? | Purpose                                                                                |
| -------------------- | ------- | -------------------------------------------------------------------------------------- |
| `NODE_ENV`           | no      | `production` on a prod host.                                                           |
| `DATABASE_URL`       | yes     | Postgres connection string used by the app and migrator.                               |
| `REDIS_URL`          | yes     | Redis connection string.                                                               |
| `S3_ENDPOINT`        | no      | Blob store host.                                                                       |
| `S3_BUCKET`          | no      | Bucket for tenant logos. Defaults to `queue-logos`.                                    |
| `S3_ACCESS_KEY`      | yes     | Blob access key.                                                                       |
| `S3_SECRET_KEY`      | yes     | Blob secret key.                                                                       |
| `S3_PUBLIC_URL_BASE` | no      | Optional. Use when a CDN fronts the bucket. Defaults to `${S3_ENDPOINT}/${S3_BUCKET}`. |
| `QR_TOKEN_SECRET`    | yes     | 32+ char secret that signs display QR tokens. Rotating invalidates every live QR.      |
| `HOST_JWT_SECRET`    | yes     | 32+ char secret that signs host session JWTs. Rotating signs every host out.           |
| `ADMIN_EMAILS`       | no      | Comma-separated allow list. Only these emails can sign in to `/admin`.                 |
| `NEXTAUTH_SECRET`    | yes     | 16+ char secret for NextAuth (admin sessions).                                         |
| `NEXTAUTH_URL`       | no      | Public base URL. Must match the host serving the app.                                  |
| `RESEND_API_KEY`     | yes     | Resend key for admin magic links.                                                      |

Edit `.env.prod`, then `docker compose --env-file .env.prod … up -d` — no restart is needed if only `ADMIN_EMAILS` changed, but a bounce of `app` picks it up within seconds.

---

## 4. Backup — nightly pg_dump + blob mirror

```bash
# Postgres dump (custom format — smaller and pg_restore-friendly).
docker compose exec -T postgres pg_dump -U queue -d queue -Fc > \
  /srv/pila-lang/backups/queue-$(date +%F).dump

# MinIO mirror (local target). Requires the mc alias to be set once.
docker run --rm --network host minio/mc alias set local \
  http://localhost:9000 $S3_ACCESS_KEY $S3_SECRET_KEY
docker run --rm --network host -v /srv/pila-lang/backups:/backups minio/mc \
  mirror --overwrite local/queue-logos /backups/logos-$(date +%F)
```

Cron example (`/etc/cron.d/pila-lang`):

```
0 3 * * * root /srv/pila-lang/ops/backup.sh >> /var/log/pila-lang-backup.log 2>&1
```

Retention: delete dumps older than 14 days (`find ... -mtime +14 -delete`).

---

## 5. Restore from backup

```bash
# Stop the app first so no writes race the restore.
docker compose -f docker-compose.yml -f docker-compose.prod.yml stop app

# Restore postgres.
docker compose exec -T postgres \
  pg_restore -U queue -d queue --clean --if-exists < \
  /srv/pila-lang/backups/queue-2026-04-19.dump

# Restore blobs.
docker run --rm --network host -v /srv/pila-lang/backups:/backups minio/mc \
  mirror --overwrite /backups/logos-2026-04-19 local/queue-logos

# Bring the app back up.
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d app
curl -fsS http://localhost:3000/api/health
```

---

## 6. Password-rotation recovery

A host lost their password. You do not need their help.

1. Open `/admin/tenants` and click the tenant.
2. Click **Reset host password**.
3. A new one-time plaintext password appears. Copy it.
4. Deliver the password to the manager out-of-band.

The previous password version is bumped, which signs out every device currently holding a session cookie — they get a 401 on their next action and land back on the login page.

If the admin-side UI is unreachable, connect to postgres directly and run:

```sql
UPDATE tenants SET host_password_version = host_password_version + 1 WHERE slug = '<slug>';
```

— then issue a new password via the admin UI once available. The version bump is what kicks live sessions.

---

## 7. Admin allow-list management

Add or remove admin emails by editing `ADMIN_EMAILS` in `.env.prod` (comma-separated) and restarting the app container:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  --env-file .env.prod up -d --force-recreate app
```

This is read at boot; hot reload of the value is not supported.

---

## 8. Log inspection

```bash
docker compose logs -f app
```

Structured events you'll see — grep for these names:

- `party.joined`, `party.seated`, `party.removed`, `party.left`, `party.restored`
- `host.login.ok`, `host.login.failed`, `host.password.rotated`
- `admin.tenant.created`, `admin.tenant.deleted`, `admin.demo.reset`
- `admin.magic_link.blocked`, `admin.sign_in.blocked`

Each entry is a single JSON line. Pipe through `jq` for filtering:

```bash
docker compose logs --no-log-prefix app | jq -r 'select(.event=="host.login.failed")'
```

---

## 9. Troubleshooting

**"SSE clients disconnect every few seconds."** Check the reverse proxy timeout. Nginx default is 60s — raise `proxy_read_timeout` to 120s+. The stream sends `:ping` comments every 15s so idle timeout never fires in a healthy deployment.

**"Logo uploads return 500."** Verify MinIO is reachable from the `app` container: `docker compose exec app wget -qO- http://minio:9000/minio/health/live`. If that fails, MinIO is down. If it succeeds, check `S3_ACCESS_KEY`/`S3_SECRET_KEY` in `.env.prod`.

**"Redis OOM."** Pub/sub + rate limits should never exceed a few MB. If Redis is at the `maxmemory` limit, something else in the network is writing to it. Confirm `SELECT 0` keys with `redis-cli DBSIZE`.

**"Guest wait page shows `Reconnecting…` permanently."** The SSE stream is rejecting the cookie or the party no longer exists. Check the app logs for the session token from that guest's request; a common cause is a demo reset that removed the row while the browser stayed open.

**"Display QR rotates but phones say `expired`."** The display page and the guest device clocks are out of sync. The QR token has a generous overlap window, but more than a minute of drift breaks it. Fix NTP on the display tablet.

---

## 10. Mobile (v1.5): Firebase, APNs, universal links

### Env vars

Optional in dev, required in prod once push goes live:

- `FIREBASE_SERVICE_ACCOUNT_JSON` — base64 of the Firebase Admin service-account JSON (or the raw JSON). The server decodes it at first use; invalid input degrades `PushNotifier` back to no-op and logs `push.firebase.bad_credential`.
- `GUEST_JWT_SECRET` — 32+ char secret for guest bearer tokens (mobile app). Must be set in every environment the app runs in; missing = boot failure.
- `APP_IOS_BUNDLE_ID` — e.g. `com.pila.app`. Must match the bundle id in the iOS build + the `appIDs` entry in `public/.well-known/apple-app-site-association`.
- `APP_ANDROID_PACKAGE_NAME` — e.g. `com.pila.app`. Must match `package_name` in `public/.well-known/assetlinks.json`.
- `APP_ANDROID_SHA256_FINGERPRINTS` — comma-separated uppercase colon-delimited SHA-256 fingerprints (debug + release keystores).

### Firebase project

1. Firebase console → Create Project (or pick existing). Add iOS and Android apps under the project with the bundle id / package name above.
2. Project settings → Service accounts → Generate new private key. This yields a JSON file. Store it as `FIREBASE_SERVICE_ACCOUNT_JSON` (preferably base64-encoded: `base64 -w 0 firebase.json`). **Never commit.**
3. Project settings → Cloud Messaging → APNs authentication key → upload the `.p8` you export from the Apple Developer portal. Key id + team id are both filled in by the form.
4. Download `GoogleService-Info.plist` (iOS) and `google-services.json` (Android) and drop them into `flutter/ios/Runner/` and `flutter/android/app/` respectively. Both paths are gitignored.

### Universal Links / App Links

- `public/.well-known/apple-app-site-association` is served with `Content-Type: application/json` (wired in `next.config.mjs`). Replace `TEAMID.com.pila.app` with your Apple Team ID + bundle id before deploy.
- `public/.well-known/assetlinks.json` lists the Android SHA-256 fingerprints. Get them with `keytool -list -v -keystore <path>` and replace the `REPLACE:WITH:...` placeholders.
- Claim paths: `/r/*` (guest join + wait), `/host/*`, `/display/*`. The tech spec draft mentions `/q/*`; the live code uses `/r/*`, so the association files follow the live code.
- Verify after deploy:
  ```bash
  curl -sI https://<host>/.well-known/apple-app-site-association | grep -i content-type
  curl -sI https://<host>/.well-known/assetlinks.json | grep -i content-type
  ```
  Both must return `application/json`. Apple's validator: https://search.developer.apple.com/appsearch-validation-tool . Google's validator: https://developers.google.com/digital-asset-links/tools/generator .

### Push credential rotation

1. Rotate the Firebase service-account key: console → Service accounts → generate a new key, then revoke the old one.
2. Deploy the new `FIREBASE_SERVICE_ACCOUNT_JSON` and bounce the app. Dispatch resumes on the next seat event; no device tokens need re-registration.
3. APNs auth key rotation is the same, with the caveat that the old key stays valid for a short window — upload the new one first, then revoke the old.
4. Device tokens that the server sees as invalid (FCM returns `messaging/registration-token-not-registered`) are auto-revoked in the `push_tokens` table and recorded as `notifications.status='token_revoked'`.

### Flutter toolchain

Install Flutter + Dart (Dart is bundled):

```bash
brew install --cask flutter
flutter config --no-analytics --no-enable-android  # if no Android toolchain yet
flutter doctor                                      # iOS + Chrome should be green
```

Xcode must already be installed. Accept its licences with `sudo xcodebuild -runFirstLaunch` if `flutter doctor` complains.

Flutter is an independent build tree under `flutter/`:

```bash
cd flutter
flutter pub get
flutter analyze
flutter test
flutter run -d <device>
```

iOS/Android native shells have already been generated. If you ever need to regenerate them, first back up `pubspec.yaml`, `analysis_options.yaml`, `README.md`, `.gitignore`, and `lib/main.dart` — `flutter create` leaves pre-existing files untouched but double-checking is cheap.

```bash
flutter create --org com.pila --project-name pila --platforms=ios,android .
```

After any regeneration, re-apply the iOS associated-domains entitlement and the Android `<intent-filter android:autoVerify="true">` on `MainActivity` (see `ios/Runner/Runner.entitlements` and `android/app/src/main/AndroidManifest.xml` for the canonical versions).

### Phase 9 manual verification (requires device + Firebase)

Phase 9 ships guest-mobile code that is **push-dormant by default**: with no `GoogleService-Info.plist` / `google-services.json` on device, `ensureFirebase()` catches the init failure and leaves `pushEnabled=false`. The SSE-only path still verifies end-to-end without Firebase.

1. **Throwaway Firebase project**: Firebase console → new project → add iOS + Android apps with bundle id `com.pila.pila` (default from `flutter create`). Download the config files and drop them into `flutter/ios/Runner/` and `flutter/android/app/`.
2. **APNs auth key**: Apple Developer → Certificates, Identifiers & Profiles → Keys → `.p8` with APNs enabled; upload to the Firebase Cloud Messaging tab. Required for any real iOS push — iOS simulators can't receive APNs.
3. **Run on a physical iPhone**:
   ```bash
   cd flutter && flutter run -d <device-udid> \
     --dart-define=PILA_API_BASE_URL=https://<your-dev-host> \
     --dart-define=PILA_LINK_HOST=<your-dev-host>
   ```
4. **Smoke flow**:
   - Scan the demo display's QR with the OS camera → app opens on the join screen with the token pre-read.
   - Complete the join form → wait screen renders within 1 second, position ticker starts.
   - From the web host, seat the guest → within a few seconds the app (backgrounded or not) shows the seated terminal screen. If backgrounded, a system notification arrives.
   - Deny notification permission and repeat → the SSE path still drives the terminal transition; no push arrives.
   - Put the device in airplane mode with the app on a terminal screen, force-quit, reopen → the screen renders from sqflite without network.
5. **Universal / App Links**:
   - iOS: `xcrun simctl openurl booted https://<your-host>/r/demo?t=<token>` on a simulator that has the app installed.
   - Android: `adb shell am start -W -a android.intent.action.VIEW -d "https://<your-host>/r/demo?t=<token>"`.
   - Both should land directly on the Flutter join screen, not the browser.

### Phase 9 automated verification (no device required)

```bash
GUEST_JWT_SECRET=<32+char> pnpm test          # server suite incl. guest-guard
cd flutter && flutter analyze && flutter test  # Dart suite incl. router matrix, reducer, party store, push coordinator
```

### Phase 10 manual verification (host mobile)

Phase 10 ships the host surface. No push is involved — the host only consumes SSE + REST. A throwaway Firebase project is still useful so `ensureFirebase()` doesn't short-circuit the guest flow on the same build, but it is not required to verify host screens.

Run against the dev docker stack (`docker compose up -d postgres redis minio migrator && pnpm db:migrate && pnpm seed --tenant=demo && pnpm dev`):

1. **Login:**
   - `flutter run -d <device-or-simulator> --dart-define=PILA_API_BASE_URL=http://<host-reachable-from-device>:3000`
   - Navigate to `/host/demo`. Submit the demo password from `pnpm seed` output.
   - Wrong password → inline "Wrong password" error. After 10 attempts, the endpoint rate-limits the IP — expect a "Try again in Ns" countdown.
   - Successful login → queue screen renders with tenant header + waiting list.
2. **Live queue:**
   - From a second browser tab, join the queue via `/r/demo`. Within 1 second the row appears in the mobile queue.
   - Tap Seat → row moves to Recently resolved, 5s snackbar with Undo action.
   - Tap Undo → row returns to waiting at its original joinedAt position.
3. **Cross-device undo:**
   - Seat a party on the mobile host, immediately undo from the web host at `http://localhost:3000/host/demo/queue`. One succeeds; the other shows "Too late to undo" or "Already handled on another device".
4. **Open/close toggle:**
   - Tap the pill → confirmation dialog on close only. Within 60 seconds the display page at `/display/demo` flips to the closed banner.
5. **Settings:**
   - Rename and change accent color. The header updates on the next reducer event.
   - Pick a PNG < 500KB from the camera roll → logo renders on every surface within seconds.
   - Try an SVG or 1MB PNG → rejected client-side before the network call.
6. **Password rotation:**
   - Rotate password from mobile. Switch to the web host tab and click any action → redirected to login with "Session expired".
7. **Guest history:**
   - Paginate past 25 rows → scroll fetches more.
   - Timestamps render in the tenant's timezone (default "Asia/Kolkata" in seeded demo).
8. **Reconnect + stale:**
   - Toggle airplane mode briefly while on the queue screen. A "Reconnecting…" banner appears; action buttons disable. Re-enable network → buttons re-enable after the next snapshot.
   - Leave the app backgrounded for >2 minutes, then cold-launch offline → queue shows last cached snapshot with a "Showing last known state" banner and disabled writes.

### Phase 10 automated verification (no device required)

```bash
pnpm test                                     # includes the extended host-stream test
cd flutter && flutter analyze && flutter test  # adds host reducer, controller, store, api mapping, stream events
```

### Interactive iOS Simulator smoke (optional)

For visual verification of Flutter screens on the iPhone Simulator beyond what unit tests cover:

- **Boot the sim**: `xcrun simctl boot "iPhone 16 Pro" && open -a Simulator`.
- **Land on a specific route**: `cd flutter && flutter run -d <sim-udid> --route=/host/demo` — `--route` seeds the initial GoRouter location so you can skip past the splash on cold-launch.
- **Tap / type from the CLI** requires `cliclick` (`brew install cliclick`) plus **Accessibility** permission granted to the terminal running the CLI (System Settings → Privacy & Security → Accessibility → toggle on your terminal; requires terminal restart). Without Accessibility, `cliclick`, `osascript` System Events, `screencapture` of the sim window, and JXA `Application("Simulator").windows` all fail.
- **Auth-gated routes** (`/host/:slug/queue`, `/settings`, `/guests`) need a host bearer in secure storage. The cheapest path is to submit the password via the login screen; a future `--dart-define=PILA_SMOKE_HOST_TOKEN=...` hook could pre-seed it for fully unattended smokes.
- **Pod / plugin conflicts** (Phase 10): iOS Podfile `platform :ios` is pinned to `15.0` to satisfy Firebase 11 + GoogleDataTransport 10+ constraints; `mobile_scanner` is on `^7.2.0` (same API as 5.x).

### Phase 11 — Display kiosk, distribution, acceptance

Phase 11 adds the display surface, kiosk-mode plumbing, and an `integration_test` suite. Actual TestFlight upload + signed APK release ship behind operator credentials that aren't in the repo.

#### Kiosk bootstrap (first launch on a mounted tablet)

1. `flutter run -d <device>` or install the built IPA/APK.
2. The app lands on `/display` — a slug-entry form.
3. Enter the tenant slug (e.g. `demo`) and tap **Pair**.
4. The display screen activates: landscape-locked, wake-lock enabled, immersive mode on Android, idle-timer disabled on iOS. The tenant header renders on a black backdrop with a full-bleed QR in the center.
5. **Re-pairing**: long-press the upper-left corner for 3 seconds → clears pairing and returns to `/display`.
6. **Cold launch after pairing**: `main.dart` reads the pairing row from `kiosk_pairing` in `pila_mobile.db` and sets the router's `initialLocation` to `/display/<slug>` — no pairing screen on subsequent launches.
7. Operator layer:
   - iOS: enable **Guided Access** (Settings → Accessibility → Guided Access) to lock the device to the app. Triple-click side button to start a session.
   - Android: pin the app via **App Pinning** (Settings → Security → Advanced → App pinning), or install a dedicated launcher (e.g. Kiosk Browser) if stricter lockdown is needed.

#### iOS build + TestFlight

Prerequisites: an Apple Developer account with Team ID, a signed provisioning profile, and the `GoogleService-Info.plist` from Firebase if push is wanted.

1. In Xcode: open `flutter/ios/Runner.xcworkspace`. Select the **Runner** target → Signing & Capabilities → check **Automatically manage signing**. Pick your Team.
2. Set the build bundle identifier to match `com.pila.pila` (already in `project.pbxproj`). Add capabilities: **Associated Domains** (`applinks:<your-host>`), **Push Notifications**, **Background Modes → Remote notifications** if using push.
3. Replace `applinks:pila.example.com` in `flutter/ios/Runner/Runner.entitlements` with your production host.
4. Replace the literal `TEAMID` in `public/.well-known/apple-app-site-association` with your Team ID (format: `ABCDE12345.com.pila.pila`).
5. Upload an APNs auth key to Firebase console → Cloud Messaging (required for real push; simulator receives none).
6. Drop `GoogleService-Info.plist` into `flutter/ios/Runner/` (gitignored).
7. Build + archive:
   ```bash
   cd flutter
   flutter build ipa --release --export-options-plist=ios/ExportOptions.plist
   ```
   Or open the workspace in Xcode and run Product → Archive → Distribute App → App Store Connect → Upload.
8. In App Store Connect → TestFlight: wait for the build to finish processing (5–15 min), add internal testers by email, enable the build for their group.

#### Android build + APK/AAB distribution

Prerequisites: a JDK 17 + a release keystore.

1. Generate a keystore if you don't have one:
   ```bash
   keytool -genkey -v -keystore ~/.android/pila-release.jks \
     -keyalg RSA -keysize 2048 -validity 10000 -alias pila
   ```
2. Create `flutter/android/key.properties` (gitignored) with:
   ```
   storePassword=<pw>
   keyPassword=<pw>
   keyAlias=pila
   storeFile=/absolute/path/to/pila-release.jks
   ```
3. Add a `signingConfigs.release` block in `flutter/android/app/build.gradle.kts` that reads `key.properties` and wire `buildTypes.release` to it. (Currently release is signed with the debug keystore — explicit TODO in the file.)
4. Obtain SHA-256 fingerprints (both debug + release) for App Link verification:
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   keytool -list -v -keystore ~/.android/pila-release.jks -alias pila
   ```
5. Replace the two `REPLACE:WITH:...:FINGERPRINT` placeholders in `public/.well-known/assetlinks.json` with the uppercase colon-delimited fingerprints.
6. Drop `google-services.json` into `flutter/android/app/` (gitignored).
7. Build the release artifact:
   ```bash
   flutter build appbundle --release    # Play Store (preferred)
   flutter build apk --release          # direct-download
   ```
8. Distribute: upload the `.aab` to Play Console → Internal testing, or host the `.apk` on a signed-download URL (Firebase App Distribution is a good zero-setup option). Post install instructions in the operator's onboarding doc.

#### Universal Link verification after deploy

```bash
curl -sI https://<host>/.well-known/apple-app-site-association | grep -i content-type
curl -sI https://<host>/.well-known/assetlinks.json | grep -i content-type
```

Both must return `application/json`. Then:

- **iOS validator**: https://search.developer.apple.com/appsearch-validation-tool — enter your production host. The AASA must reference `TEAMID.com.pila.pila`.
- **Android validator**: https://developers.google.com/digital-asset-links/tools/generator — paste the `assetlinks.json`. `package_name` must match the release build's `applicationId` (`com.pila.pila`).

Set `APP_ANDROID_PACKAGE_NAME=com.pila.pila` in the production env (not `com.pila.app` — the repo's default for that env var is stale).

#### Integration test local run

Requires the dev stack (Next.js + Postgres + Redis + MinIO) running on `http://localhost:3000` with `NODE_ENV=test` so the `/api/test/*` routes are mounted.

```bash
# terminal 1 — dev stack
docker compose up -d postgres redis minio migrator
pnpm db:migrate
NODE_ENV=test pnpm dev

# terminal 2 — integration tests on a booted iOS simulator
cd flutter
flutter test integration_test/sales_demo_test.dart \
  -d "iPhone 16 Pro" \
  --dart-define=PILA_API_BASE_URL=http://localhost:3000
flutter test integration_test/host_flow_test.dart \
  -d "iPhone 16 Pro" \
  --dart-define=PILA_API_BASE_URL=http://localhost:3000
flutter test integration_test/display_flow_test.dart \
  -d "iPhone 16 Pro" \
  --dart-define=PILA_API_BASE_URL=http://localhost:3000
```

Tests are idempotent — each one calls `/api/test/reset-tenant` + `/api/test/flush-redis` before seeding. On Android, swap the device id for `emulator-5554` (launch via `~/Library/Android/sdk/emulator/emulator -avd Pixel_7_API_34` or the Android Studio AVD manager).

**CI note**: integration_test is **not** wired into GitHub Actions yet. Running the full stack on a Mac runner is a separate infra task; see `progress.md` Phase 11 deferrals.

#### Phase 11 manual smoke (display flow)

1. `pnpm seed --tenant=demo` (if not already seeded).
2. `cd flutter && flutter run -d <sim-or-device> --dart-define=PILA_API_BASE_URL=http://<host>:3000 --route=/display`.
3. Pair with slug `demo`. Display renders QR + tenant header.
4. From the web host at `http://localhost:3000/host/demo`, toggle **Close queue** → display swaps to "Not accepting guests right now" within ~2 seconds (SSE-driven).
5. Reopen → QR returns.
6. Wait ≥60 seconds — QR refreshes with a 200ms fade (no blank frame).
7. Toggle airplane mode on the device briefly → reconnect without manual intervention.
8. Long-press upper-left corner for 3s → returns to pairing screen.

#### Deferred under Phase 11

- **Actual TestFlight upload** — requires an Apple Developer account with a provisioning profile. Documentation above covers the steps; the upload itself is operator-driven.
- **Actual signed APK release** — requires a real keystore. Same rationale.
- **Cross-surface push timing acceptance** — "seat action on the web host surfaces to the Flutter guest as a push within 3 seconds on both iOS and Android" requires Firebase provisioned + physical iOS and Android devices.
- **CI wiring for integration_test** — requires a Mac runner able to host the full dev stack (Postgres + Redis + MinIO + Next.js). Tracked in progress.md.

---

## 12. On-call contact

Pager rotation lives in the team's on-call tool. For out-of-band escalation, check the project README for maintainer emails.
