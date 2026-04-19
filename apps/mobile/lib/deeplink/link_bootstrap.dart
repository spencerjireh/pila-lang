import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:go_router/go_router.dart';

import 'parser.dart';
import 'router.dart';

/// Wires platform-level deep-link events into the app's go_router. Handles
/// both cold start (initial link) and warm start (link stream while the app
/// is resumed).
class LinkBootstrap {
  LinkBootstrap({AppLinks? links, DeepLinkParser? parser})
      : _links = links ?? AppLinks(),
        _parser = parser ?? const DeepLinkParser();

  final AppLinks _links;
  final DeepLinkParser _parser;
  StreamSubscription<Uri>? _sub;

  /// Reads the launch URI (if the app was cold-started via deep link).
  Future<String?> initialLocation() async {
    final initial = await _links.getInitialLink();
    if (initial == null) return null;
    return deepLinkToLocation(_parser.parseUri(initial));
  }

  /// Subscribes to warm-start URIs and pushes them onto the provided
  /// [router]. Call [dispose] to cancel.
  void attach(GoRouter router) {
    _sub = _links.uriLinkStream.listen((uri) {
      final location = deepLinkToLocation(_parser.parseUri(uri));
      if (location != null) router.go(location);
    });
  }

  Future<void> dispose() async {
    await _sub?.cancel();
  }
}
