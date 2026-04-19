import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/host_api.dart';

DioException _exception({
  required int? status,
  Map<String, dynamic>? body,
  Map<String, String>? headers,
  String? networkMessage,
}) {
  final req = RequestOptions(path: '/test');
  if (status == null) {
    return DioException.connectionError(
      requestOptions: req,
      reason: networkMessage ?? 'network',
    );
  }
  final headersMap = <String, List<String>>{
    for (final e in (headers ?? const <String, String>{}).entries) e.key: <String>[e.value],
  };
  final res = Response<Map<String, dynamic>>(
    requestOptions: req,
    data: body,
    statusCode: status,
    headers: Headers.fromMap(headersMap),
  );
  return DioException.badResponse(
    statusCode: status,
    requestOptions: req,
    response: res,
  );
}

void main() {
  group('mapHostApiError', () {
    test('maps 401 invalid_credentials to unauthorized', () {
      final ex = mapHostApiError(_exception(
        status: 401,
        body: <String, dynamic>{'error': 'invalid_credentials'},
      ),);
      expect(ex.code, HostApiError.unauthorized);
      expect(ex.statusCode, 401);
    });

    test('maps 403 forbidden to unauthorized', () {
      final ex = mapHostApiError(
        _exception(status: 403, body: <String, dynamic>{'error': 'forbidden'}),
      );
      expect(ex.code, HostApiError.unauthorized);
    });

    test('maps 404 to notFound', () {
      final ex = mapHostApiError(
        _exception(status: 404, body: <String, dynamic>{'error': 'not_found'}),
      );
      expect(ex.code, HostApiError.notFound);
    });

    test('maps 409 too_old to tooLateToUndo', () {
      final ex = mapHostApiError(
        _exception(status: 409, body: <String, dynamic>{'error': 'too_old'}),
      );
      expect(ex.code, HostApiError.tooLateToUndo);
    });

    test('maps 409 no_action to noAction', () {
      final ex = mapHostApiError(
        _exception(status: 409, body: <String, dynamic>{'error': 'no_action'}),
      );
      expect(ex.code, HostApiError.noAction);
    });

    test('maps generic 409 (e.g. seat conflict) to conflict', () {
      final ex = mapHostApiError(
        _exception(status: 409, body: <String, dynamic>{'error': 'conflict'}),
      );
      expect(ex.code, HostApiError.conflict);
    });

    test('maps 413 to logoTooLarge', () {
      final ex = mapHostApiError(
        _exception(status: 413, body: <String, dynamic>{'error': 'too_large'}),
      );
      expect(ex.code, HostApiError.logoTooLarge);
    });

    test('maps 415 to logoBadMime', () {
      final ex = mapHostApiError(
        _exception(status: 415, body: <String, dynamic>{'error': 'invalid_mime'}),
      );
      expect(ex.code, HostApiError.logoBadMime);
    });

    test('maps 422 to invalidAccent', () {
      final ex = mapHostApiError(_exception(
        status: 422,
        body: <String, dynamic>{'error': 'invalid_accent_color'},
      ),);
      expect(ex.code, HostApiError.invalidAccent);
    });

    test('maps 429 with Retry-After to rateLimited + retryAfterSeconds', () {
      final ex = mapHostApiError(_exception(
        status: 429,
        body: <String, dynamic>{'error': 'rate_limited'},
        headers: <String, String>{'retry-after': '30'},
      ),);
      expect(ex.code, HostApiError.rateLimited);
      expect(ex.retryAfterSeconds, 30);
    });

    test('maps 502 to storageFailed', () {
      final ex = mapHostApiError(_exception(
        status: 502,
        body: <String, dynamic>{'error': 'storage_failed'},
      ),);
      expect(ex.code, HostApiError.storageFailed);
    });

    test('maps 400 bad_dimensions to logoBadDimensions', () {
      final ex = mapHostApiError(_exception(
        status: 400,
        body: <String, dynamic>{'error': 'bad_dimensions'},
      ),);
      expect(ex.code, HostApiError.logoBadDimensions);
    });

    test('maps 400 decode_failed to logoDecodeFailed', () {
      final ex = mapHostApiError(_exception(
        status: 400,
        body: <String, dynamic>{'error': 'decode_failed'},
      ),);
      expect(ex.code, HostApiError.logoDecodeFailed);
    });

    test('maps other 4xx bodies to invalidBody', () {
      final ex = mapHostApiError(_exception(
        status: 400,
        body: <String, dynamic>{'error': 'invalid_body'},
      ),);
      expect(ex.code, HostApiError.invalidBody);
    });

    test('maps connection errors (no status) to network', () {
      final ex = mapHostApiError(
        _exception(status: null, networkMessage: 'host unreachable'),
      );
      expect(ex.code, HostApiError.network);
    });
  });
}
