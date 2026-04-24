import 'package:dio/dio.dart';

/// Fields common to every Dio-sourced API error. Each surface's mapper
/// (`mapHostApiError`, `mapDisplayApiError`) extracts these once then
/// picks a domain enum.
class DioErrorFields {
  const DioErrorFields({
    required this.statusCode,
    required this.errorCode,
    required this.retryAfterSeconds,
    required this.networkMessage,
  });

  /// HTTP status if the response was received; null means transport failure.
  final int? statusCode;

  /// Canonical `error` string from the JSON envelope (see
  /// packages/shared/src/http/error-response.ts).
  final String? errorCode;

  /// `Retry-After` header parsed to seconds. Present only on 429s today.
  final int? retryAfterSeconds;

  /// Dio's `err.message` when there's no response at all (DNS, timeout).
  final String? networkMessage;
}

DioErrorFields extractDioError(DioException err) {
  final status = err.response?.statusCode;
  final data = err.response?.data;
  final errorCode = data is Map<String, dynamic>
      ? data['error'] as String?
      : null;
  final retryAfter = err.response?.headers.value('retry-after') ??
      err.response?.headers.value('Retry-After');
  return DioErrorFields(
    statusCode: status,
    errorCode: errorCode,
    retryAfterSeconds:
        retryAfter == null ? null : int.tryParse(retryAfter),
    networkMessage: status == null ? err.message : null,
  );
}
