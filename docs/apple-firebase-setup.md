# Pila Lang — Apple + Firebase setup checklist

Living checklist for Apple Developer enrollment, Firebase provisioning, and mobile push wiring. Tick items as you go; commits on this setup branch land each change.

Bundle ID used everywhere: **`com.pilalang.app`**

---

## Day 1 — kick off async stuff

- [ ] **Apple Developer enrollment** ($99/yr, Individual) — `developer.apple.com/programs/enroll`. Needs Apple ID with 2FA on. Takes 24-48h to approve.
- [x] **Create Firebase project** — `console.firebase.google.com` → Add project → display name **"PilaLang"** (grab project ID `pilalang` if available, else accept the `pilalang-xxxxx` suffix — ID is permanent). Skip Analytics.
- [x] **Register Android app in Firebase** — package name `com.pilalang.app`. `flutterfire configure` will drop `google-services.json` into `apps/mobile/android/app/`. The file is gitignored; every checkout regenerates it locally.
- [x] **Register iOS app in Firebase** — bundle ID `com.pilalang.app`. `flutterfire configure` drops `GoogleService-Info.plist` into `apps/mobile/ios/Runner/`. Same gitignored, regenerate-locally treatment as Android.

## Day 1-2 — wire Firebase into the Flutter app (no Apple needed)

- [x] **Install FlutterFire CLI** — `dart pub global activate flutterfire_cli` (also required: `npm install -g firebase-tools` and `gem install xcodeproj` via homebrew Ruby)
- [x] **Run `flutterfire configure`** from `apps/mobile/` — links both apps, generates `lib/firebase_options.dart`, places `google-services.json` + `GoogleService-Info.plist` in the right spots
- [x] (I do) **Update `apps/mobile/lib/push/firebase_bootstrap.dart`** to pass `options: DefaultFirebaseOptions.currentPlatform` into `Firebase.initializeApp()`
- [x] **Firebase config files are gitignored** — `apps/mobile/android/app/google-services.json`, `apps/mobile/ios/Runner/GoogleService-Info.plist`, and `apps/mobile/lib/firebase_options.dart`. Every checkout regenerates them locally via `flutterfire configure --project=pilalang`. CI falls back to `lib/firebase_options.example.dart` for `flutter analyze`. Real security controls live in Google Cloud Console and App Check — see §Post-v1.5 Firebase hardening.
- [ ] **Smoke test on Android** — physical device or emulator; run the app, verify FCM token registers via `/api/guest/push/register`. Android push works without Apple.

## Day 1-2 — server-side Firebase (parallel track)

- [x] **Generate service account JSON** — Firebase Console → Project Settings → Service accounts → Generate new private key. Save the JSON.
- [x] **Set `FIREBASE_SERVICE_ACCOUNT_JSON`** in your local `.env` (base64-encoded; source JSON moved to `~/.secrets/pila/`).
- [x] (I do) **Uncomment the env var in `.env.example`** with a placeholder
- [x] **Verify server picks it up** — confirmed decodeServiceAccount + firebase-admin initializeApp succeeds for project `pilalang`

## Day 2-3 — after Apple approval email arrives

- [x] **Register bundle ID in App Store Connect** — Certificates, IDs & Profiles → Identifiers → `com.pilalang.app` → enable **Push Notifications** capability
- [x] **Create APNs Auth Key (.p8)** — Key ID `2UJ44L935Y`, stored at `~/.secrets/pila/AuthKey_2UJ44L935Y.p8` (0600).
- [x] **Upload .p8 to Firebase** — Firebase Console → Project Settings → Cloud Messaging → Apple app → Upload APNs Auth Key.
- [x] **Xcode signing** — open `apps/mobile/ios/Runner.xcworkspace`, select Runner target → Signing & Capabilities:
  - [x] Sign in with dev account, select Team
  - [x] Enable **Push Notifications** capability (→ `aps-environment=production` in `Runner.entitlements`; see §iOS entitlements policy below for why we don't split per build config)
  - [x] Enable **Background Modes** → check **Remote notifications** (→ `UIBackgroundModes=[remote-notification]` in `Info.plist`)
- [x] (I do) **Commit the generated `Runner.entitlements`** once Xcode creates it

## Day 3 — verify end-to-end

- [ ] **iOS push smoke test on physical device** (simulator won't work) — join a queue as a guest, have host seat the party, confirm push arrives
- [ ] **Android push smoke test** on physical device (or emulator with Google Play Services)
- [ ] If nothing arrives, check in this order: token registered? `/api/guest/push/register` returns 200? FCM send call returns success in server logs? APNs .p8 uploaded for the right bundle ID?

---

## Separate track — Android release signing (low priority, do before any Play Store path)

- [ ] Generate Android release keystore (`keytool -genkey …`); store **outside git**, somewhere you'll still have in 2 years
- [ ] Create `apps/mobile/android/key.properties` (gitignored) with the keystore path + passwords
- [ ] (I do) **Update `apps/mobile/android/app/build.gradle.kts`** — replace the debug-signing shortcut with a real release `signingConfig`

---

## Decisions still pending

- [ ] **Domain** — bundle ID doesn't require it, but you'll need one before pilot (web hosting, Universal Links, magic-link sender domain). Cheap options: `pilalang.com` (~$12/yr), `trypila.com` (~$12/yr), `pila.lang` (~$30-40/yr). Pick now, don't agonize.
- [ ] **Apple App Store seller name** — will show as your legal name under Individual enrollment. OK with that, or wait and enroll as an LLC later via App Transfer?
- [ ] **App icon + splash screen** — Flutter is using defaults. Needed before TestFlight.

---

## Ownership split

- **You do:** account signups, payments, console UI clicks, Xcode UI clicks, physical device testing, anything that requires your credentials or a phone in hand.
- **I (Claude) do:** any repo edit — `firebase_bootstrap.dart` changes, `.gitignore` entries, `.env.example` tweaks, Android signing config, committing entitlement files you generate.

Ping me when a checkbox needs code and I'll do it in the same branch.

---

## Post-v1.5 Firebase hardening

Tracked follow-ups after the v1.5 mobile push cut. None are pre-pilot blockers; all are prerequisites for production push rollout.

- [ ] **API key application restrictions** — in Google Cloud Console (`console.cloud.google.com/apis/credentials` for project `pilalang`), restrict the Android key to package `com.pilalang.app` + the signing SHA-1, and the iOS key to bundle `com.pilalang.app`. Allow-list only the Firebase APIs we use (`firebase.googleapis.com`, `identitytoolkit.googleapis.com`, `fcm.googleapis.com`). Per Firebase docs these keys identify the project and belong in app code — application restrictions + App Check are the real controls.
- [ ] **Firebase App Check** — integrate `firebase_app_check` in `apps/mobile/lib/push/firebase_bootstrap.dart` with Play Integrity (Android) + App Attest (iOS). Roll out with the debug provider locally, monitor the ≥90% valid-token threshold in the Firebase Console App Check dashboard, then enable enforcement per service. We only use FCM today, so enforcement starts and ends there for v1.5.

## iOS entitlements policy

`apps/mobile/ios/Runner/Runner.entitlements` sets `aps-environment=production` for every build configuration. There is no Debug/Release split.

**Tradeoff.** Production APNs refuses sandbox-environment builds, so push notifications won't deliver to local `flutter run` builds on a paired device. Everything else (SSE, queue, login, image upload) works fine in dev. To verify push end-to-end, ship a TestFlight build — see `docs/RUNBOOK.md` §Phase 11.

**Why not split per build config.** The "proper" path is `Runner-Debug.entitlements` (development) + `Runner-Release.entitlements` (production), wired per Xcode build configuration. We're not doing that for v1: solo pre-pilot, one entitlement file is easier to reason about, and push UX iteration isn't a current bottleneck. Recorded in case it becomes one.

**Escape hatch.** If iterating on push UX in dev becomes painful, do the split:

1. Rename the current file to `Runner-Debug.entitlements` and change its `aps-environment` to `development`.
2. Create `Runner-Release.entitlements` (copy of the current file, `aps-environment=production`).
3. In `apps/mobile/ios/Runner.xcodeproj/project.pbxproj`, set `CODE_SIGN_ENTITLEMENTS` per `XCBuildConfiguration` — Debug → `Runner/Runner-Debug.entitlements`, Release + Profile → `Runner/Runner-Release.entitlements`.
4. Verify via `xcodebuild -showBuildSettings -configuration Release` that `CODE_SIGN_ENTITLEMENTS` resolves to the Release file.

---

## Reference

- Bundle ID rename commit: `f70567f`
- Design system: `DESIGN.md` (palette TBD until MJ mood-lock)
- MJ prompt library: `docs/mj-prompts.md`
- Server push wiring: `packages/shared/src/push/firebase.ts` reads `FIREBASE_SERVICE_ACCOUNT_JSON`
- Flutter push bootstrap: `apps/mobile/lib/push/firebase_bootstrap.dart`
