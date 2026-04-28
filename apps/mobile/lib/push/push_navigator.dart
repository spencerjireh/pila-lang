import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:go_router/go_router.dart';

import '../deeplink/parser.dart';
import '../deeplink/router.dart';
import 'firebase_bootstrap.dart';
import 'push_client.dart';

/// Bridges FCM notification taps onto the app's go_router. Reads
/// `data["deeplink"]` from the remote message, parses it through the same
/// [DeepLinkParser] used for app_links, and navigates. Cold-start taps are
/// surfaced via [initialLocation]; warm-start taps via [attach].
class PushNavigator {
  PushNavigator({
    PushClient? client,
    DeepLinkParser? parser,
    bool Function()? pushGate,
  })  : _client = client ?? PushClient(),
        _parser = parser ?? const DeepLinkParser(),
        _gate = pushGate ?? (() => pushEnabled);

  final PushClient _client;
  final DeepLinkParser _parser;
  final bool Function() _gate;
  StreamSubscription<RemoteMessage>? _sub;

  Future<String?> initialLocation() async {
    if (!_gate()) return null;
    // Time-bound: on iOS Simulator without APNs setup, the underlying FCM
    // call can hang forever waiting for APNs registration. Bound it so the
    // app always boots; a real push tap on device returns near-instantly.
    final RemoteMessage? msg;
    try {
      msg = await _client
          .getInitialMessage()
          .timeout(const Duration(seconds: 2), onTimeout: () => null);
    } catch (_) {
      return null;
    }
    final uri = _extract(msg);
    if (uri == null) return null;
    debugPrint('[smoke] [push] cold-start tap deeplink=$uri');
    final loc = deepLinkToLocation(_parser.parse(uri));
    if (loc != null) {
      debugPrint('[smoke] [push] navigated to $loc');
    }
    return loc;
  }

  void attach(GoRouter router) {
    if (!_gate()) return;
    _sub = _client.onMessageOpenedApp.listen((msg) {
      final uri = _extract(msg);
      if (uri == null) return;
      debugPrint('[smoke] [push] tapped deeplink=$uri');
      final loc = deepLinkToLocation(_parser.parse(uri));
      if (loc == null) return;
      debugPrint('[smoke] [push] navigated to $loc');
      router.go(loc);
    });
  }

  Future<void> dispose() async {
    await _sub?.cancel();
    _sub = null;
  }

  String? _extract(RemoteMessage? msg) {
    if (msg == null) return null;
    final raw = msg.data['deeplink'];
    if (raw is! String || raw.isEmpty) return null;
    return raw;
  }
}
