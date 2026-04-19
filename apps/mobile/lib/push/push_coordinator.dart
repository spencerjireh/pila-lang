import 'dart:async';

import '../api/guest_api.dart';
import '../api/models.dart';
import 'firebase_bootstrap.dart';
import 'push_client.dart';

/// Orchestrates the push lifecycle for the guest app:
///   - [maybeRegister]  called after first successful join; asks the OS for
///                      permission, fetches an FCM token, and posts to
///                      `/api/push/register`.
///   - [unregister]     called on terminal party state; posts to
///                      `/api/push/unregister`.
/// Foreground messages are intentionally swallowed; SSE is the source of
/// truth for UI state.
class PushCoordinator {
  PushCoordinator({
    required GuestApi api,
    PushClient? client,
    bool Function()? pushEnabledGate,
  })  : _api = api,
        _client = client ?? PushClient(),
        _gate = pushEnabledGate ?? (() => pushEnabled);

  final GuestApi _api;
  final PushClient _client;
  final bool Function() _gate;
  String? _registeredDeviceToken;
  StreamSubscription<void>? _foregroundSub;

  bool get isRegistered => _registeredDeviceToken != null;

  Future<RegisterOutcome> maybeRegister() async {
    if (!_gate()) return RegisterOutcome.disabled;
    final token = await _client.requestPermissionAndToken();
    if (token == null) return RegisterOutcome.permissionDenied;
    try {
      await _api.registerPushToken(
        platform: _client.platform,
        deviceToken: token,
      );
    } catch (_) {
      return RegisterOutcome.networkFailure;
    }
    _registeredDeviceToken = token;
    _foregroundSub ??= _client.onForegroundMessage.listen((_) {
      // SSE is authoritative for UI state. Drop silently.
    });
    return RegisterOutcome.registered;
  }

  Future<void> unregister() async {
    final token = _registeredDeviceToken;
    if (token == null) return;
    try {
      await _api.unregisterPushToken(deviceToken: token);
    } catch (_) {
      // Best effort — server also GCs via revoke path.
    }
    _registeredDeviceToken = null;
    await _foregroundSub?.cancel();
    _foregroundSub = null;
  }

  Future<void> onStatusChanged(PartyStatus status) async {
    if (status.isTerminal) await unregister();
  }

  Future<void> dispose() async {
    await _foregroundSub?.cancel();
    _foregroundSub = null;
  }
}

enum RegisterOutcome {
  disabled,
  permissionDenied,
  networkFailure,
  registered,
}
