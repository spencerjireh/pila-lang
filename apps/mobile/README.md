# Pila Lang — Flutter workspace

Guest, host, and display surfaces in one Flutter binary. See the root docs for everything else:

- **Run on simulator / on-device dev / hot reload / TestFlight pre-flight** — `../../ONBOARDING.md` §13
- **TestFlight + APK distribution procedure** — `../../docs/RUNBOOK.md` §Phase 11
- **One-time Apple Developer + Firebase setup** — `../../docs/apple-firebase-setup.md`

```
flutter pub get      # install dependencies
flutter analyze      # lint + type check (treated as errors in CI)
flutter test         # unit + widget tests
flutter run -d <id>  # run on simulator or paired device
```

`firebase_options.dart`, `ios/Runner/GoogleService-Info.plist`, and `android/app/google-services.json` are gitignored — regenerate locally with `flutterfire configure --project=pilalang`.
