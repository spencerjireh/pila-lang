sealed class DeepLink {
  const DeepLink();
}

class GuestJoinLink extends DeepLink {
  const GuestJoinLink({required this.slug, required this.token});
  final String slug;
  final String token;
}

class GuestWaitLink extends DeepLink {
  const GuestWaitLink({required this.slug, required this.partyId});
  final String slug;
  final String partyId;
}

class HostLink extends DeepLink {
  const HostLink({required this.slug});
  final String slug;
}

class DisplayLink extends DeepLink {
  const DisplayLink({required this.slug});
  final String slug;
}

class UnknownLink extends DeepLink {
  const UnknownLink(this.raw);
  final String raw;
}

/// Maps incoming URIs (from Universal Links / App Links or the in-app QR
/// scanner) to a typed route. Deliberately matches the web paths:
///   /r/<slug>?t=<token>
///   /r/<slug>/wait/<partyId>
///   /host/<slug>
///   /display/<slug>
class DeepLinkParser {
  const DeepLinkParser();

  DeepLink parse(String input) {
    Uri uri;
    try {
      uri = Uri.parse(input);
    } catch (_) {
      return UnknownLink(input);
    }
    return parseUri(uri);
  }

  DeepLink parseUri(Uri uri) {
    // Universal Links keep the route in pathSegments (host = pilalang.spencerjireh.com).
    // Custom URL schemes like `pilalang://r/<slug>` put the first route token
    // in `uri.host` instead. Normalize both shapes here.
    final isWeb = uri.scheme == 'http' || uri.scheme == 'https';
    final segments = (!isWeb && uri.host.isNotEmpty)
        ? <String>[uri.host, ...uri.pathSegments]
        : uri.pathSegments;
    if (segments.isEmpty) return UnknownLink(uri.toString());

    if (segments.first == 'r' && segments.length >= 2) {
      final slug = segments[1];
      if (slug.isEmpty) return UnknownLink(uri.toString());
      if (segments.length == 2) {
        final token = uri.queryParameters['t'];
        if (token == null || token.isEmpty) return UnknownLink(uri.toString());
        return GuestJoinLink(slug: slug, token: token);
      }
      if (segments.length == 4 && segments[2] == 'wait') {
        final partyId = segments[3];
        if (partyId.isEmpty) return UnknownLink(uri.toString());
        return GuestWaitLink(slug: slug, partyId: partyId);
      }
    }

    if (segments.first == 'host' && segments.length >= 2) {
      final slug = segments[1];
      if (slug.isEmpty) return UnknownLink(uri.toString());
      return HostLink(slug: slug);
    }

    if (segments.first == 'display' && segments.length >= 2) {
      final slug = segments[1];
      if (slug.isEmpty) return UnknownLink(uri.toString());
      return DisplayLink(slug: slug);
    }

    return UnknownLink(uri.toString());
  }
}
