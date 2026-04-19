import 'dart:convert';

import 'package:http/http.dart' as http;

/// Thin HTTP helper around the `/api/test/*` + `/api/display/*` +
/// `/api/host/*` routes used by the integration suite. These tests assume
/// the Next.js dev server is running at `baseUrl` (default
/// `http://localhost:3000`) in `NODE_ENV=test` so the `/api/test/*`
/// endpoints are mounted.
class PilaTestClient {
  PilaTestClient({String? baseUrl, http.Client? client})
      : baseUrl = baseUrl ??
            const String.fromEnvironment(
              'PILA_API_BASE_URL',
              defaultValue: 'http://localhost:3000',
            ),
        _http = client ?? http.Client();

  final String baseUrl;
  final http.Client _http;

  Future<TenantHandle> setupTenant({
    required String slug,
    String name = 'Integration Demo',
    String accentColor = '#1F6FEB',
    String timezone = 'Asia/Kolkata',
    bool isOpen = true,
    String password = 'integration-test-pw',
    List<Map<String, dynamic>> waitingParties = const <Map<String, dynamic>>[],
  }) async {
    final res = await _http.post(
      Uri.parse('$baseUrl/api/test/setup-tenant'),
      headers: <String, String>{'content-type': 'application/json'},
      body: jsonEncode(<String, dynamic>{
        'slug': slug,
        'name': name,
        'accentColor': accentColor,
        'timezone': timezone,
        'isOpen': isOpen,
        'password': password,
        'waitingParties': waitingParties,
      }),
    );
    _ensureOk(res, 'setup-tenant');
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return TenantHandle(
      id: body['id'] as String,
      slug: body['slug'] as String,
      password: body['password'] as String,
    );
  }

  Future<void> resetTenant(String slug) async {
    final res = await _http.post(
      Uri.parse('$baseUrl/api/test/reset-tenant'),
      headers: <String, String>{'content-type': 'application/json'},
      body: jsonEncode(<String, dynamic>{'slug': slug}),
    );
    _ensureOk(res, 'reset-tenant');
  }

  Future<void> flushRedis() async {
    final res =
        await _http.post(Uri.parse('$baseUrl/api/test/flush-redis'));
    _ensureOk(res, 'flush-redis');
  }

  Future<String> mintQrToken(String slug) async {
    final res =
        await _http.get(Uri.parse('$baseUrl/api/display/$slug/token'));
    _ensureOk(res, 'display-token');
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return body['token'] as String;
  }

  Future<String> exchangeHostToken({
    required String slug,
    required String password,
  }) async {
    final res = await _http.post(
      Uri.parse('$baseUrl/api/host/token'),
      headers: <String, String>{'content-type': 'application/json'},
      body: jsonEncode(<String, dynamic>{'slug': slug, 'password': password}),
    );
    _ensureOk(res, 'host-token');
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return body['token'] as String;
  }

  Future<List<Map<String, dynamic>>> listWaitingParties({
    required String slug,
    required String bearer,
  }) async {
    final res = await _http.get(
      Uri.parse('$baseUrl/api/host/$slug/queue/snapshot'),
      headers: <String, String>{'authorization': 'Bearer $bearer'},
    );
    _ensureOk(res, 'queue-snapshot');
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final waiting = body['waiting'] as List<dynamic>? ?? <dynamic>[];
    return waiting.cast<Map<String, dynamic>>();
  }

  Future<void> seatParty({
    required String slug,
    required String partyId,
    required String bearer,
  }) async {
    final res = await _http.post(
      Uri.parse('$baseUrl/api/host/$slug/parties/$partyId/seat'),
      headers: <String, String>{'authorization': 'Bearer $bearer'},
    );
    _ensureOk(res, 'seat');
  }

  Future<void> closeQueue({
    required String slug,
    required String bearer,
  }) async {
    final res = await _http.post(
      Uri.parse('$baseUrl/api/host/$slug/close'),
      headers: <String, String>{'authorization': 'Bearer $bearer'},
    );
    _ensureOk(res, 'close-queue');
  }

  Future<void> openQueue({
    required String slug,
    required String bearer,
  }) async {
    final res = await _http.post(
      Uri.parse('$baseUrl/api/host/$slug/open'),
      headers: <String, String>{'authorization': 'Bearer $bearer'},
    );
    _ensureOk(res, 'open-queue');
  }

  void close() => _http.close();

  void _ensureOk(http.Response res, String op) {
    if (res.statusCode >= 200 && res.statusCode < 300) return;
    throw StateError('$op failed (${res.statusCode}): ${res.body}');
  }
}

class TenantHandle {
  const TenantHandle({
    required this.id,
    required this.slug,
    required this.password,
  });

  final String id;
  final String slug;
  final String password;
}
