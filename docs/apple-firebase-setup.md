# Pila Lang — Apple + Firebase setup checklist

Living checklist for Apple Developer enrollment, Firebase provisioning, and mobile push wiring. Tick items as you go; commits on `setup/apple-firebase` land each change.

Bundle ID used everywhere: **`com.pilalang.app`**

---

## Day 1 — kick off async stuff

- [ ] **Apple Developer enrollment** ($99/yr, Individual) — `developer.apple.com/programs/enroll`. Needs Apple ID with 2FA on. Takes 24-48h to approve.
- [x] **Create Firebase project** — `console.firebase.google.com` → Add project → display name **"PilaLang"** (grab project ID `pilalang` if available, else accept the `pilalang-xxxxx` suffix — ID is permanent). Skip Analytics.
- [x] **Register Android app in Firebase** — package name `com.pilalang.app`. Download `google-services.json`. Save locally; don't commit yet.
- [x] **Register iOS app in Firebase** — bundle ID `com.pilalang.app`. Download `GoogleService-Info.plist`. Save locally; don't commit yet.

## Day 1-2 — wire Firebase into the Flutter app (no Apple needed)

- [x] **Install FlutterFire CLI** — `dart pub global activate flutterfire_cli` (also required: `npm install -g firebase-tools` and `gem install xcodeproj` via homebrew Ruby)
- [x] **Run `flutterfire configure`** from `apps/mobile/` — links both apps, generates `lib/firebase_options.dart`, places `google-services.json` + `GoogleService-Info.plist` in the right spots
- [x] (I do) **Update `apps/mobile/lib/push/firebase_bootstrap.dart`** to pass `options: DefaultFirebaseOptions.currentPlatform` into `Firebase.initializeApp()`
- [x] (I do) **Add the two Firebase config files to `.gitignore`** (per-environment, not secret but shouldn't be in git) — already gitignored at root
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
  - [x] Enable **Push Notifications** capability (→ `aps-environment=development` in `Runner.entitlements`)
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

## Reference

- Bundle ID rename commit: `f70567f`
- Design system: `DESIGN.md` (palette TBD until MJ mood-lock)
- MJ prompt library: `docs/mj-prompts.md`
- Server push wiring: `packages/shared/src/push/firebase.ts` reads `FIREBASE_SERVICE_ACCOUNT_JSON`
- Flutter push bootstrap: `apps/mobile/lib/push/firebase_bootstrap.dart`
