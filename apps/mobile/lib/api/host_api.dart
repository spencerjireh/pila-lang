import 'dart:io';

import 'package:dio/dio.dart';

import 'error_mapper.dart';
import 'host_models.dart';

enum HostApiError {
  unauthorized,
  rateLimited,
  conflict,
  tooLateToUndo,
  noAction,
  invalidBody,
  invalidAccent,
  logoTooLarge,
  logoBadMime,
  logoBadDimensions,
  logoDecodeFailed,
  storageFailed,
  notFound,
  network,
  unknown,
}

class HostApiException implements Exception {
  HostApiException({
    required this.code,
    this.statusCode,
    this.retryAfterSeconds,
    this.message,
  });

  final HostApiError code;
  final int? statusCode;
  final int? retryAfterSeconds;
  final String? message;

  @override
  String toString() =>
      'HostApiException(${code.name}, status=$statusCode, retry=$retryAfterSeconds)';
}

/// Small wrapper so every method's `on DioException → mapHostApiError` line
/// lives in exactly one place.
Future<T> _guard<T>(Future<T> Function() fn) async {
  try {
    return await fn();
  } on DioException catch (err) {
    throw mapHostApiError(err);
  }
}

const Map<String, dynamic> _jsonHeader = <String, dynamic>{
  'Content-Type': 'application/json',
};

class HostApi {
  HostApi({required Dio authed, required String baseUrl})
      : _authed = authed,
        _baseUrl = baseUrl;

  final Dio _authed;
  final String _baseUrl;

  Future<HostBearerResponse> exchangeToken({
    required String slug,
    required String password,
  }) async {
    final dio = Dio(BaseOptions(baseUrl: _baseUrl));
    try {
      return await _guard(() async {
        final res = await dio.post<Map<String, dynamic>>(
          '/api/host/token',
          data: <String, dynamic>{'slug': slug, 'password': password},
          options: Options(headers: _jsonHeader),
        );
        return HostBearerResponse.fromJson(res.data!);
      });
    } finally {
      dio.close(force: true);
    }
  }

  Future<void> logout(String slug) => _guard(
        () async => _authed.post<void>('/api/host/$slug/logout'),
      );

  Future<DateTime> seat({required String slug, required String partyId}) =>
      _guard(() async {
        final res = await _authed.post<Map<String, dynamic>>(
          '/api/host/$slug/parties/$partyId/seat',
        );
        return DateTime.parse(res.data!['resolvedAt'] as String);
      });

  Future<DateTime> removeParty({
    required String slug,
    required String partyId,
  }) =>
      _guard(() async {
        final res = await _authed.post<Map<String, dynamic>>(
          '/api/host/$slug/parties/$partyId/remove',
        );
        return DateTime.parse(res.data!['resolvedAt'] as String);
      });

  Future<UndoResponse> undo(String slug) => _guard(() async {
        final res = await _authed.post<Map<String, dynamic>>(
          '/api/host/$slug/undo',
        );
        return UndoResponse.fromJson(res.data!);
      });

  Future<bool> openQueue(String slug) => _guard(() async {
        final res = await _authed.post<Map<String, dynamic>>(
          '/api/host/$slug/open',
        );
        return res.data!['isOpen'] as bool;
      });

  Future<bool> closeQueue(String slug) => _guard(() async {
        final res = await _authed.post<Map<String, dynamic>>(
          '/api/host/$slug/close',
        );
        return res.data!['isOpen'] as bool;
      });

  Future<Map<String, dynamic>> updateGeneral({
    required String slug,
    String? name,
    String? accentColor,
  }) {
    final body = <String, dynamic>{
      if (name != null) 'name': name,
      if (accentColor != null) 'accentColor': accentColor,
    };
    return _guard(() async {
      final res = await _authed.patch<Map<String, dynamic>>(
        '/api/host/$slug/settings/general',
        data: body,
        options: Options(headers: _jsonHeader),
      );
      return res.data!['tenant'] as Map<String, dynamic>;
    });
  }

  Future<String?> uploadLogo({
    required String slug,
    required File file,
    required String filename,
    required String mimeType,
  }) async {
    final form = FormData.fromMap(<String, dynamic>{
      'file': await MultipartFile.fromFile(
        file.path,
        filename: filename,
        contentType: _parseMediaType(mimeType),
      ),
    });
    return _guard(() async {
      final res = await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/settings/logo',
        data: form,
      );
      return res.data!['logoUrl'] as String?;
    });
  }

  Future<void> clearLogo(String slug) => _guard(
        () async => _authed.post<Map<String, dynamic>>(
          '/api/host/$slug/settings/logo',
          data: <String, dynamic>{'clear': true},
          options: Options(headers: _jsonHeader),
        ),
      );

  Future<int> rotatePassword({
    required String slug,
    required String newPassword,
  }) =>
      _guard(() async {
        final res = await _authed.post<Map<String, dynamic>>(
          '/api/host/$slug/settings/password',
          data: <String, dynamic>{
            'action': 'rotate',
            'newPassword': newPassword,
          },
          options: Options(headers: _jsonHeader),
        );
        return (res.data!['version'] as num).toInt();
      });

  Future<int> logoutOthers(String slug) => _guard(() async {
        final res = await _authed.post<Map<String, dynamic>>(
          '/api/host/$slug/settings/password',
          data: <String, dynamic>{'action': 'logout-others'},
          options: Options(headers: _jsonHeader),
        );
        return (res.data!['version'] as num).toInt();
      });

  Future<GuestHistoryPage> listGuests({
    required String slug,
    String? cursor,
    int? limit,
  }) =>
      _guard(() async {
        final res = await _authed.get<Map<String, dynamic>>(
          '/api/host/$slug/guests',
          queryParameters: <String, dynamic>{
            if (cursor != null) 'cursor': cursor,
            if (limit != null) 'limit': limit,
          },
        );
        return GuestHistoryPage.fromJson(res.data!);
      });

  static DioMediaType? _parseMediaType(String raw) {
    final parts = raw.split('/');
    if (parts.length != 2) return null;
    return DioMediaType(parts[0], parts[1]);
  }
}

const Map<int, HostApiError> _statusToCode = <int, HostApiError>{
  401: HostApiError.unauthorized,
  403: HostApiError.unauthorized,
  404: HostApiError.notFound,
  413: HostApiError.logoTooLarge,
  415: HostApiError.logoBadMime,
  422: HostApiError.invalidAccent,
  429: HostApiError.rateLimited,
  502: HostApiError.storageFailed,
};

const Map<String, HostApiError> _errorCodeToCode = <String, HostApiError>{
  'too_old': HostApiError.tooLateToUndo,
  'no_action': HostApiError.noAction,
  'bad_dimensions': HostApiError.logoBadDimensions,
  'decode_failed': HostApiError.logoDecodeFailed,
};

/// Visible for tests; keep next to [HostApi] so mapping rules stay
/// in sync with error shapes from each endpoint.
HostApiException mapHostApiError(DioException err) {
  final f = extractDioError(err);
  if (f.statusCode == null) {
    return HostApiException(
      code: HostApiError.network,
      message: f.networkMessage,
    );
  }
  return HostApiException(
    code: _resolveHostCode(f.statusCode!, f.errorCode),
    statusCode: f.statusCode,
    retryAfterSeconds: f.retryAfterSeconds,
    message: f.errorCode,
  );
}

HostApiError _resolveHostCode(int status, String? errorCode) {
  final byStatus = _statusToCode[status];
  if (byStatus != null) return byStatus;
  if (status == 409) {
    return _errorCodeToCode[errorCode] ?? HostApiError.conflict;
  }
  if (status >= 400 && status < 500) {
    return _errorCodeToCode[errorCode] ?? HostApiError.invalidBody;
  }
  return HostApiError.unknown;
}
