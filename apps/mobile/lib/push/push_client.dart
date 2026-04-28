import 'dart:io' show Platform;

import 'package:firebase_messaging/firebase_messaging.dart';

/// Thin wrapper around the FCM device token lifecycle. The registration call
/// to the Pila server lives in `lib/auth/http_client.dart`; this class is only
/// responsible for obtaining the token and exposing message streams.
class PushClient {
  PushClient({FirebaseMessaging? messaging})
      : _messaging = messaging ?? FirebaseMessaging.instance;

  final FirebaseMessaging _messaging;

  Future<String?> requestPermissionAndToken() async {
    final settings = await _messaging.requestPermission();
    if (settings.authorizationStatus == AuthorizationStatus.denied) {
      return null;
    }
    return _messaging.getToken();
  }

  Stream<String> get onTokenRefresh => _messaging.onTokenRefresh;

  Stream<RemoteMessage> get onForegroundMessage =>
      FirebaseMessaging.onMessage;

  Stream<RemoteMessage> get onMessageOpenedApp =>
      FirebaseMessaging.onMessageOpenedApp;

  Future<RemoteMessage?> getInitialMessage() => _messaging.getInitialMessage();

  String get platform => Platform.isIOS ? 'ios' : 'android';
}
