import 'package:firebase_core/firebase_core.dart';

/// Global gate for push features. `false` when Firebase config files are
/// missing (local dev without `flutterfire configure`, test environments),
/// so the coordinator and UI can short-circuit without spurious errors.
bool _pushEnabled = false;
bool get pushEnabled => _pushEnabled;

/// Attempts to initialise Firebase. Returns true on success, false if config
/// is absent or platform plugins are unavailable. Never throws.
Future<bool> ensureFirebase() async {
  try {
    if (Firebase.apps.isNotEmpty) {
      _pushEnabled = true;
      return true;
    }
    await Firebase.initializeApp();
    _pushEnabled = true;
    return true;
  } catch (_) {
    _pushEnabled = false;
    return false;
  }
}

/// Testing hook: flip the flag without touching real Firebase plugins.
void debugSetPushEnabled(bool value) {
  _pushEnabled = value;
}
