import 'parser.dart';

/// Maps a parsed [DeepLink] onto a go_router location string. Returning
/// `null` means "unroutable — fall back to the app's default landing".
/// Pure function; no IO. Tests exercise this directly.
String? deepLinkToLocation(DeepLink link) {
  switch (link) {
    case GuestJoinLink(:final slug, :final token):
      return '/r/$slug?t=${Uri.encodeComponent(token)}';
    case GuestWaitLink(:final slug, :final partyId):
      return '/r/$slug/wait/$partyId';
    case HostLink(:final slug):
      return '/host/$slug';
    case DisplayLink(:final slug):
      return '/display/$slug';
    case UnknownLink _:
      return null;
  }
}
