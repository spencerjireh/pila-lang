import 'dart:io';

import 'package:dio/dio.dart';

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
      final res = await dio.post<Map<String, dynamic>>(
        '/api/host/token',
        data: <String, dynamic>{'slug': slug, 'password': password},
        options: Options(
          headers: <String, dynamic>{'Content-Type': 'application/json'},
        ),
      );
      return HostBearerResponse.fromJson(res.data!);
    } on DioException catch (err) {
      throw mapHostApiError(err);
    } finally {
      dio.close(force: true);
    }
  }

  Future<void> logout(String slug) async {
    try {
      await _authed.post<void>('/api/host/$slug/logout');
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<DateTime> seat({required String slug, required String partyId}) async {
    try {
      final res = await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/parties/$partyId/seat',
      );
      return DateTime.parse(res.data!['resolvedAt'] as String);
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<DateTime> removeParty({
    required String slug,
    required String partyId,
  }) async {
    try {
      final res = await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/parties/$partyId/remove',
      );
      return DateTime.parse(res.data!['resolvedAt'] as String);
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<UndoResponse> undo(String slug) async {
    try {
      final res = await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/undo',
      );
      return UndoResponse.fromJson(res.data!);
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<bool> openQueue(String slug) async {
    try {
      final res = await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/open',
      );
      return res.data!['isOpen'] as bool;
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<bool> closeQueue(String slug) async {
    try {
      final res = await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/close',
      );
      return res.data!['isOpen'] as bool;
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<Map<String, dynamic>> updateGeneral({
    required String slug,
    String? name,
    String? accentColor,
  }) async {
    final body = <String, dynamic>{};
    if (name != null) body['name'] = name;
    if (accentColor != null) body['accentColor'] = accentColor;
    try {
      final res = await _authed.patch<Map<String, dynamic>>(
        '/api/host/$slug/settings/general',
        data: body,
        options: Options(
          headers: <String, dynamic>{'Content-Type': 'application/json'},
        ),
      );
      return res.data!['tenant'] as Map<String, dynamic>;
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
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
    try {
      final res = await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/settings/logo',
        data: form,
      );
      return res.data!['logoUrl'] as String?;
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<void> clearLogo(String slug) async {
    try {
      await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/settings/logo',
        data: <String, dynamic>{'clear': true},
        options: Options(
          headers: <String, dynamic>{'Content-Type': 'application/json'},
        ),
      );
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<int> rotatePassword({
    required String slug,
    required String newPassword,
  }) async {
    try {
      final res = await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/settings/password',
        data: <String, dynamic>{
          'action': 'rotate',
          'newPassword': newPassword,
        },
        options: Options(
          headers: <String, dynamic>{'Content-Type': 'application/json'},
        ),
      );
      return (res.data!['version'] as num).toInt();
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<int> logoutOthers(String slug) async {
    try {
      final res = await _authed.post<Map<String, dynamic>>(
        '/api/host/$slug/settings/password',
        data: <String, dynamic>{'action': 'logout-others'},
        options: Options(
          headers: <String, dynamic>{'Content-Type': 'application/json'},
        ),
      );
      return (res.data!['version'] as num).toInt();
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  Future<GuestHistoryPage> listGuests({
    required String slug,
    String? cursor,
    int? limit,
  }) async {
    try {
      final res = await _authed.get<Map<String, dynamic>>(
        '/api/host/$slug/guests',
        queryParameters: <String, dynamic>{
          if (cursor != null) 'cursor': cursor,
          if (limit != null) 'limit': limit,
        },
      );
      return GuestHistoryPage.fromJson(res.data!);
    } on DioException catch (err) {
      throw mapHostApiError(err);
    }
  }

  static DioMediaType? _parseMediaType(String raw) {
    final parts = raw.split('/');
    if (parts.length != 2) return null;
    return DioMediaType(parts[0], parts[1]);
  }
}

/// Visible for tests; keep next to [HostApi] so mapping rules stay
/// in sync with error shapes from each endpoint.
HostApiException mapHostApiError(DioException err) {
  final status = err.response?.statusCode;
  final data = err.response?.data;
  final errorCode =
      data is Map<String, dynamic> ? data['error'] as String? : null;
  final retryAfter = err.response?.headers.value('retry-after') ??
      err.response?.headers.value('Retry-After');
  final retryAfterSec = retryAfter == null ? null : int.tryParse(retryAfter);

  if (status == null) {
    return HostApiException(
      code: HostApiError.network,
      message: err.message,
    );
  }
  if (status == 401 || status == 403) {
    return HostApiException(
      code: HostApiError.unauthorized,
      statusCode: status,
      message: errorCode,
    );
  }
  if (status == 404) {
    return HostApiException(
      code: HostApiError.notFound,
      statusCode: status,
      message: errorCode,
    );
  }
  if (status == 409) {
    final code = errorCode == 'too_old'
        ? HostApiError.tooLateToUndo
        : errorCode == 'no_action'
            ? HostApiError.noAction
            : HostApiError.conflict;
    return HostApiException(
      code: code,
      statusCode: status,
      message: errorCode,
    );
  }
  if (status == 413) {
    return HostApiException(
      code: HostApiError.logoTooLarge,
      statusCode: status,
      message: errorCode,
    );
  }
  if (status == 415) {
    return HostApiException(
      code: HostApiError.logoBadMime,
      statusCode: status,
      message: errorCode,
    );
  }
  if (status == 422) {
    return HostApiException(
      code: HostApiError.invalidAccent,
      statusCode: status,
      message: errorCode,
    );
  }
  if (status == 429) {
    return HostApiException(
      code: HostApiError.rateLimited,
      statusCode: status,
      retryAfterSeconds: retryAfterSec,
      message: errorCode,
    );
  }
  if (status == 502) {
    return HostApiException(
      code: HostApiError.storageFailed,
      statusCode: status,
      message: errorCode,
    );
  }
  if (status >= 400 && status < 500) {
    if (errorCode == 'bad_dimensions') {
      return HostApiException(
        code: HostApiError.logoBadDimensions,
        statusCode: status,
        message: errorCode,
      );
    }
    if (errorCode == 'decode_failed') {
      return HostApiException(
        code: HostApiError.logoDecodeFailed,
        statusCode: status,
        message: errorCode,
      );
    }
    return HostApiException(
      code: HostApiError.invalidBody,
      statusCode: status,
      message: errorCode,
    );
  }
  return HostApiException(
    code: HostApiError.unknown,
    statusCode: status,
    message: errorCode,
  );
}
