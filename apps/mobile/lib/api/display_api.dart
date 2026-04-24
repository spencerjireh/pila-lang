import 'package:dio/dio.dart';

import 'display_models.dart';
import 'error_mapper.dart';

enum DisplayApiError {
  notFound,
  rateLimited,
  network,
  unknown,
}

class DisplayApiException implements Exception {
  DisplayApiException({
    required this.code,
    this.statusCode,
    this.retryAfterSeconds,
    this.message,
  });

  final DisplayApiError code;
  final int? statusCode;
  final int? retryAfterSeconds;
  final String? message;

  @override
  String toString() =>
      'DisplayApiException(${code.name}, status=$statusCode, retry=$retryAfterSeconds)';
}

/// Unauthenticated client against the public `/api/display/<slug>/token`
/// endpoint. The display surface has no bearer; rate limits are IP-keyed.
class DisplayApi {
  DisplayApi({required String baseUrl, Dio? dio})
      : _baseUrl = baseUrl,
        _dio = dio ?? Dio(BaseOptions(baseUrl: baseUrl));

  final String _baseUrl;
  final Dio _dio;

  String get baseUrl => _baseUrl;

  Future<DisplayTokenPayload> fetchToken(String slug) async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(
        '/api/display/$slug/token',
        options: Options(
          headers: <String, dynamic>{'Cache-Control': 'no-store'},
        ),
      );
      return DisplayTokenPayload.fromJson(res.data!);
    } on DioException catch (err) {
      throw mapDisplayApiError(err);
    }
  }
}

const Map<int, DisplayApiError> _statusToCode = <int, DisplayApiError>{
  404: DisplayApiError.notFound,
  429: DisplayApiError.rateLimited,
};

/// Visible for tests so the 404/429/network branches are asserted
/// against canonical DioException shapes.
DisplayApiException mapDisplayApiError(DioException err) {
  final f = extractDioError(err);
  if (f.statusCode == null) {
    return DisplayApiException(
      code: DisplayApiError.network,
      message: f.networkMessage,
    );
  }
  return DisplayApiException(
    code: _statusToCode[f.statusCode!] ?? DisplayApiError.unknown,
    statusCode: f.statusCode,
    retryAfterSeconds: f.retryAfterSeconds,
    message: f.errorCode,
  );
}
