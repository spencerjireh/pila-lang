import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/display_api.dart';

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
    for (final e in (headers ?? const <String, String>{}).entries)
      e.key: <String>[e.value],
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
  group('mapDisplayApiError', () {
    test('maps 404 not_found to notFound', () {
      final ex = mapDisplayApiError(
        _exception(status: 404, body: <String, dynamic>{'error': 'not_found'}),
      );
      expect(ex.code, DisplayApiError.notFound);
      expect(ex.statusCode, 404);
    });

    test('maps 429 with Retry-After to rateLimited + retryAfterSeconds', () {
      final ex = mapDisplayApiError(_exception(
        status: 429,
        body: <String, dynamic>{'error': 'rate_limited'},
        headers: <String, String>{'retry-after': '45'},
      ),);
      expect(ex.code, DisplayApiError.rateLimited);
      expect(ex.retryAfterSeconds, 45);
    });

    test('maps connection errors (no status) to network', () {
      final ex = mapDisplayApiError(
        _exception(status: null, networkMessage: 'timeout'),
      );
      expect(ex.code, DisplayApiError.network);
    });

    test('maps 500 with no recognized code to unknown', () {
      final ex = mapDisplayApiError(
        _exception(status: 500, body: <String, dynamic>{'error': 'internal'}),
      );
      expect(ex.code, DisplayApiError.unknown);
    });
  });

  group('DisplayApi.fetchToken', () {
    test('returns DisplayTokenPayload on 200', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test'));
      dio.httpClientAdapter = _StubAdapter(
        status: 200,
        body: <String, dynamic>{
          'token': 'abc.def',
          'validUntilMs': 1234567890,
          'isOpen': true,
        },
      );
      final api = DisplayApi(baseUrl: 'http://test', dio: dio);
      final payload = await api.fetchToken('demo');
      expect(payload.token, 'abc.def');
      expect(payload.validUntilMs, 1234567890);
      expect(payload.isOpen, isTrue);
    });

    test('throws DisplayApiException.notFound on 404', () async {
      final dio = Dio(BaseOptions(baseUrl: 'http://test'));
      dio.httpClientAdapter = _StubAdapter(
        status: 404,
        body: <String, dynamic>{'error': 'not_found'},
      );
      final api = DisplayApi(baseUrl: 'http://test', dio: dio);
      expect(
        () => api.fetchToken('ghost'),
        throwsA(isA<DisplayApiException>()
            .having((e) => e.code, 'code', DisplayApiError.notFound),),
      );
    });
  });
}

class _StubAdapter implements HttpClientAdapter {
  _StubAdapter({required this.status, required this.body});

  final int status;
  final Map<String, dynamic> body;

  @override
  void close({bool force = false}) {}

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    final bytes = Uint8List.fromList(utf8.encode(jsonEncode(body)));
    return ResponseBody.fromBytes(
      bytes,
      status,
      headers: <String, List<String>>{
        'content-type': <String>['application/json'],
      },
    );
  }
}
