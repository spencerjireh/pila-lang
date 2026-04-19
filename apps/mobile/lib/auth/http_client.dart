import 'package:dio/dio.dart';

import 'bearer_storage.dart';

const String kRefreshHeader = 'X-Refreshed-Token';

/// Builds a [Dio] client that:
///   - attaches the stored bearer for [scope] on every request,
///   - updates the stored bearer when the server returns `X-Refreshed-Token`,
///   - clears the bearer on a 401 so the router can return the caller to login.
Dio buildAuthedClient({
  required String baseUrl,
  required BearerStorage storage,
  required BearerScope scope,
  void Function()? onUnauthorized,
  Dio? inner,
}) {
  final dio = inner ?? Dio();
  dio.options = BaseOptions(
    baseUrl: baseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 30),
    headers: <String, dynamic>{'Accept': 'application/json'},
  );

  dio.interceptors.add(
    InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.read(scope);
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        handler.next(options);
      },
      onResponse: (response, handler) async {
        final refreshed = response.headers.value(kRefreshHeader);
        if (refreshed != null && refreshed.isNotEmpty) {
          await storage.write(scope, refreshed);
        }
        handler.next(response);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await storage.clear(scope);
          if (onUnauthorized != null) onUnauthorized();
        }
        handler.next(error);
      },
    ),
  );
  return dio;
}
