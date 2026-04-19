import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';

import 'models.dart';

/// Guest-facing HTTP client. Composes two dio instances:
///   - [_authed] — bearer-authorised via the shared interceptor chain
///     installed at construction time.
///   - [_join]   — a short-lived cookie-jar client used *only* for the
///     `POST /api/r/<slug>/join` -> `POST /api/guest/token` handoff, cleared
///     immediately after the bearer exchange.
class GuestApi {
  GuestApi({
    required Dio authed,
    required String baseUrl,
  })  : _authed = authed,
        _baseUrl = baseUrl;

  final Dio _authed;
  final String _baseUrl;

  Future<GuestInfoResponse> fetchInfo(String slug, {String? token}) async {
    final res = await _authed.get<Map<String, dynamic>>(
      '/api/r/$slug/info',
      queryParameters: token != null ? <String, dynamic>{'t': token} : null,
      options: Options(
        headers: <String, dynamic>{'Authorization': null},
        extra: <String, dynamic>{'skipAuth': true},
      ),
    );
    final data = res.data;
    if (data == null) {
      throw DioException(
        requestOptions: res.requestOptions,
        response: res,
        error: 'empty body',
      );
    }
    return GuestInfoResponse.fromJson(slug, data);
  }

  /// Joins the queue. Returns the party id + wait URL and stores the issued
  /// bearer via [onBearerIssued] before the cookie is discarded.
  Future<JoinResponse> joinAndExchange({
    required String slug,
    required String qrToken,
    required JoinInput input,
    required Future<void> Function(GuestBearerResponse) onBearerIssued,
  }) async {
    final jar = CookieJar();
    final dio = Dio(BaseOptions(baseUrl: _baseUrl));
    dio.interceptors.add(CookieManager(jar));

    try {
      final joinRes = await dio.post<Map<String, dynamic>>(
        '/api/r/$slug/join',
        queryParameters: <String, dynamic>{'t': qrToken},
        data: input.toJson(),
        options: Options(
          headers: <String, dynamic>{'Content-Type': 'application/json'},
        ),
      );
      final joinData = joinRes.data;
      if (joinData == null) {
        throw DioException(
          requestOptions: joinRes.requestOptions,
          response: joinRes,
          error: 'empty join body',
        );
      }
      final parsedJoin = JoinResponse.fromJson(joinData);

      final tokenRes = await dio.post<Map<String, dynamic>>(
        '/api/guest/token',
        data: <String, dynamic>{
          'slug': slug,
          'partyId': parsedJoin.partyId,
        },
        options: Options(
          headers: <String, dynamic>{'Content-Type': 'application/json'},
        ),
      );
      final tokenData = tokenRes.data;
      if (tokenData == null) {
        throw DioException(
          requestOptions: tokenRes.requestOptions,
          response: tokenRes,
          error: 'empty token body',
        );
      }
      final bearer = GuestBearerResponse.fromJson(tokenData);
      await onBearerIssued(bearer);
      return parsedJoin;
    } finally {
      await jar.deleteAll();
      dio.close(force: true);
    }
  }

  Future<void> leave({required String slug, required String partyId}) async {
    await _authed.post<Map<String, dynamic>>(
      '/api/r/$slug/parties/$partyId/leave',
    );
  }

  Future<String> registerPushToken({
    required String platform,
    required String deviceToken,
  }) async {
    final res = await _authed.post<Map<String, dynamic>>(
      '/api/push/register',
      data: <String, dynamic>{
        'platform': platform,
        'deviceToken': deviceToken,
      },
      options: Options(
        headers: <String, dynamic>{'Content-Type': 'application/json'},
      ),
    );
    return res.data!['id'] as String;
  }

  Future<void> unregisterPushToken({required String deviceToken}) async {
    await _authed.post<Map<String, dynamic>>(
      '/api/push/unregister',
      data: <String, dynamic>{'deviceToken': deviceToken},
      options: Options(
        headers: <String, dynamic>{'Content-Type': 'application/json'},
      ),
    );
  }
}
