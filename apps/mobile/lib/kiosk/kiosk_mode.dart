import 'package:flutter/services.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

/// Thin wrapper around the handful of platform calls that keep the display
/// screen awake, full-bleed, and locked to landscape. Activation happens in
/// the display screen's `initState`; deactivation restores normal system UI
/// when it is disposed so guest/host flows aren't affected.
class KioskMode {
  const KioskMode();

  Future<void> activate() async {
    await WakelockPlus.enable();
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
  }

  Future<void> deactivate() async {
    await SystemChrome.setPreferredOrientations(<DeviceOrientation>[
      DeviceOrientation.portraitUp,
      DeviceOrientation.portraitDown,
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    await WakelockPlus.disable();
  }
}
