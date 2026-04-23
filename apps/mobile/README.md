# Pila Lang — Flutter workspace

Phase 8 foundations. Guest / host / display screens land in Phases 9–11.

## First-time setup

1. Install Flutter stable ≥ 3.22 (`brew install --cask flutter`).
2. From the repo root: `cd flutter && flutter pub get`.
3. Scaffold the native shells (one-time, from `flutter/`):
   ```
   flutter create --org com.pila --project-name pila --platforms=ios,android .
   ```
   This generates `ios/` and `android/` directories. The `pubspec.yaml` and `lib/` already in the repo take precedence over the generated versions.
4. Apply the iOS entitlement: in `ios/Runner/Runner.entitlements` set
   ```xml
   <key>com.apple.developer.associated-domains</key>
   <array>
     <string>applinks:YOUR_WEB_HOST</string>
   </array>
   ```
   and add `applinks:YOUR_WEB_HOST` to the Signing & Capabilities tab in Xcode.
5. Apply the Android intent filter: in `android/app/src/main/AndroidManifest.xml`, inside the `.MainActivity` `<activity>`, add
   ```xml
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="https" android:host="YOUR_WEB_HOST" />
   </intent-filter>
   ```

## Commands

```
flutter pub get      # install dependencies
flutter analyze      # lint + type check
flutter test         # unit tests (lib/ + test/)
flutter run -d ios   # run on simulator
flutter run -d android
```

## Layout

- `lib/auth/` — bearer-token storage + HTTP client with interceptor
- `lib/sse/` — streaming client + reconnect state machine
- `lib/theme/` — palette ported from web Tailwind tokens
- `lib/deeplink/` — universal-link parser + router
- `lib/push/` — FCM registration + routing

Screens and navigation land in later phases.

## Push notification credentials

- `lib/firebase_options.dart`, `ios/Runner/GoogleService-Info.plist`, and `android/app/google-services.json` are **gitignored**. Generate them locally with:
  ```
  dart pub global activate flutterfire_cli
  flutterfire configure --project=pilalang
  ```
  This writes all three from the Firebase console. CI falls back to `lib/firebase_options.example.dart` for `flutter analyze` — tests don't initialize Firebase.
- API keys are restricted in GCP Console (Android package + SHA-1, iOS bundle ID, allow-listed APIs), so the values are inert outside the signed app.
- Rotation / revocation procedure lives in `../docs/RUNBOOK.md` §10.
