/// Resolved at build time via `--dart-define=PILA_API_BASE_URL=...`.
/// Defaults to a local dev server on the iOS simulator's loopback.
class PilaEnv {
  PilaEnv._();

  static const String apiBaseUrl = String.fromEnvironment(
    'PILA_API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  static const String universalLinkHost = String.fromEnvironment(
    'PILA_LINK_HOST',
    defaultValue: 'localhost:3000',
  );
}
