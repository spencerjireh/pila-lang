import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

import 'parser.dart';
import 'router.dart';

/// Reads the launch URI when the app was cold-started via a deep link
/// (Universal Link or custom URL scheme). Warm-start URIs are handled by
/// `GoRouter`'s `redirect` callback, which receives them via Flutter's
/// platform `RouteInformationProvider`; we don't subscribe separately to
/// avoid duplicate navigations.
class LinkBootstrap {
  LinkBootstrap({AppLinks? links, DeepLinkParser? parser})
      : _links = links ?? AppLinks(),
        _parser = parser ?? const DeepLinkParser();

  final AppLinks _links;
  final DeepLinkParser _parser;

  Future<String?> initialLocation() async {
    final initial = await _links.getInitialLink();
    if (initial == null) return null;
    if (kDebugMode) {
      debugPrint('[smoke] [deeplink] received cold-start path=${initial.path}');
    }
    final location = deepLinkToLocation(_parser.parseUri(initial));
    if (kDebugMode && location != null) {
      debugPrint('[smoke] [deeplink] navigated to $location');
    }
    return location;
  }
}
