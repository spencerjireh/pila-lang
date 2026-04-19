import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/guest_api.dart';
import 'package:pila/api/models.dart';
import 'package:pila/push/firebase_bootstrap.dart';
import 'package:pila/push/push_client.dart';
import 'package:pila/push/push_coordinator.dart';

class _FakePushClient implements PushClient {
  _FakePushClient({this.token, this.platformName = 'ios'});

  String? token;
  final String platformName;
  final StreamController<RemoteMessage> _foreground =
      StreamController<RemoteMessage>.broadcast();
  int requestCount = 0;

  @override
  String get platform => platformName;

  @override
  Future<String?> requestPermissionAndToken() async {
    requestCount++;
    return token;
  }

  @override
  Stream<String> get onTokenRefresh => const Stream<String>.empty();

  @override
  Stream<RemoteMessage> get onForegroundMessage => _foreground.stream;

  @override
  Stream<RemoteMessage> get onMessageOpenedApp => const Stream<RemoteMessage>.empty();

  Future<void> emitForeground() async {
    _foreground.add(const RemoteMessage());
    await Future<void>.delayed(Duration.zero);
  }
}

class _RecordingGuestApi extends GuestApi {
  _RecordingGuestApi()
      : super(
          authed: Dio(),
          baseUrl: 'http://test',
        );

  String? registeredPlatform;
  String? registeredDeviceToken;
  String? unregisteredDeviceToken;
  bool failRegister = false;

  @override
  Future<String> registerPushToken({
    required String platform,
    required String deviceToken,
  }) async {
    if (failRegister) throw StateError('register failed');
    registeredPlatform = platform;
    registeredDeviceToken = deviceToken;
    return 'row-id';
  }

  @override
  Future<void> unregisterPushToken({required String deviceToken}) async {
    unregisteredDeviceToken = deviceToken;
  }
}

void main() {
  setUp(() => debugSetPushEnabled(true));
  tearDown(() => debugSetPushEnabled(false));

  test('maybeRegister short-circuits when pushEnabled is false', () async {
    debugSetPushEnabled(false);
    final api = _RecordingGuestApi();
    final client = _FakePushClient(token: 'fcm-1');
    final coord = PushCoordinator(api: api, client: client);
    final outcome = await coord.maybeRegister();
    expect(outcome, RegisterOutcome.disabled);
    expect(client.requestCount, 0);
    expect(api.registeredDeviceToken, isNull);
  });

  test('maybeRegister returns permissionDenied when token is null', () async {
    final api = _RecordingGuestApi();
    final client = _FakePushClient(token: null);
    final coord = PushCoordinator(api: api, client: client);
    final outcome = await coord.maybeRegister();
    expect(outcome, RegisterOutcome.permissionDenied);
    expect(api.registeredDeviceToken, isNull);
  });

  test('maybeRegister posts platform + token on success', () async {
    final api = _RecordingGuestApi();
    final client = _FakePushClient(token: 'fcm-abc', platformName: 'android');
    final coord = PushCoordinator(api: api, client: client);
    final outcome = await coord.maybeRegister();
    expect(outcome, RegisterOutcome.registered);
    expect(api.registeredPlatform, 'android');
    expect(api.registeredDeviceToken, 'fcm-abc');
    expect(coord.isRegistered, isTrue);
  });

  test('maybeRegister returns networkFailure when server errors', () async {
    final api = _RecordingGuestApi()..failRegister = true;
    final client = _FakePushClient(token: 'fcm');
    final coord = PushCoordinator(api: api, client: client);
    final outcome = await coord.maybeRegister();
    expect(outcome, RegisterOutcome.networkFailure);
    expect(coord.isRegistered, isFalse);
  });

  test('unregister posts the previously registered device token', () async {
    final api = _RecordingGuestApi();
    final client = _FakePushClient(token: 'fcm-xyz');
    final coord = PushCoordinator(api: api, client: client);
    await coord.maybeRegister();
    await coord.unregister();
    expect(api.unregisteredDeviceToken, 'fcm-xyz');
    expect(coord.isRegistered, isFalse);
  });

  test('onStatusChanged triggers unregister only on terminal states', () async {
    final api = _RecordingGuestApi();
    final client = _FakePushClient(token: 'fcm');
    final coord = PushCoordinator(api: api, client: client);
    await coord.maybeRegister();
    await coord.onStatusChanged(PartyStatus.waiting);
    expect(api.unregisteredDeviceToken, isNull);
    await coord.onStatusChanged(PartyStatus.seated);
    expect(api.unregisteredDeviceToken, 'fcm');
  });

  test('foreground messages are swallowed (SSE is authoritative)', () async {
    final api = _RecordingGuestApi();
    final client = _FakePushClient(token: 'fcm');
    final coord = PushCoordinator(api: api, client: client);
    await coord.maybeRegister();
    await client.emitForeground();
    // No exception; nothing to assert beyond that the listener installed
    // when registered drops events silently.
    expect(coord.isRegistered, isTrue);
  });
}
