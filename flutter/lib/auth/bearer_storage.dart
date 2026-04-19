import 'package:flutter_secure_storage/flutter_secure_storage.dart';

enum BearerScope { host, guest }

abstract class BearerStorage {
  Future<String?> read(BearerScope scope);
  Future<void> write(BearerScope scope, String token);
  Future<void> clear(BearerScope scope);
}

class SecureBearerStorage implements BearerStorage {
  SecureBearerStorage({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static const _hostKey = 'pila.host.bearer.v1';
  static const _guestKey = 'pila.guest.bearer.v1';

  String _key(BearerScope scope) =>
      scope == BearerScope.host ? _hostKey : _guestKey;

  @override
  Future<String?> read(BearerScope scope) => _storage.read(key: _key(scope));

  @override
  Future<void> write(BearerScope scope, String token) =>
      _storage.write(key: _key(scope), value: token);

  @override
  Future<void> clear(BearerScope scope) => _storage.delete(key: _key(scope));
}

/// Test/fallback in-memory storage. Never persists.
class InMemoryBearerStorage implements BearerStorage {
  final Map<BearerScope, String> _values = <BearerScope, String>{};

  @override
  Future<String?> read(BearerScope scope) async => _values[scope];

  @override
  Future<void> write(BearerScope scope, String token) async {
    _values[scope] = token;
  }

  @override
  Future<void> clear(BearerScope scope) async {
    _values.remove(scope);
  }
}
