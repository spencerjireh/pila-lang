import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/display_models.dart';

void main() {
  group('DisplayTokenPayload.fromJson', () {
    test('parses token/validUntilMs/isOpen', () {
      final payload = DisplayTokenPayload.fromJson(<String, dynamic>{
        'token': 't123',
        'validUntilMs': 1700000000000,
        'isOpen': true,
      });
      expect(payload.token, 't123');
      expect(payload.validUntilMs, 1700000000000);
      expect(payload.isOpen, isTrue);
    });
  });

  group('DisplayStreamEvent.fromJson', () {
    test('parses ready snapshot with tenant brand', () {
      final event = DisplayStreamEvent.fromJson(jsonEncode(<String, dynamic>{
        'type': 'ready',
        'tenant': <String, dynamic>{
          'name': 'Demo',
          'logoUrl': null,
          'accentColor': '#1f6feb',
          'isOpen': true,
        },
      }),);
      expect(event, isA<DisplayReady>());
      final ready = event as DisplayReady;
      expect(ready.tenant.name, 'Demo');
      expect(ready.tenant.accentColor, '#1f6feb');
      expect(ready.tenant.isOpen, isTrue);
    });

    test('parses tenant:updated with partial fields', () {
      final event = DisplayStreamEvent.fromJson(jsonEncode(<String, dynamic>{
        'type': 'tenant:updated',
        'name': 'New name',
      }),);
      expect(event, isA<DisplayTenantUpdated>());
      final upd = event as DisplayTenantUpdated;
      expect(upd.name, 'New name');
      expect(upd.logoUrlProvided, isFalse);
      expect(upd.accentColor, isNull);
    });

    test('distinguishes logoUrl null from omitted', () {
      final withNull =
          DisplayStreamEvent.fromJson(jsonEncode(<String, dynamic>{
        'type': 'tenant:updated',
        'logoUrl': null,
      }),) as DisplayTenantUpdated;
      final omitted =
          DisplayStreamEvent.fromJson(jsonEncode(<String, dynamic>{
        'type': 'tenant:updated',
      }),) as DisplayTenantUpdated;
      expect(withNull.logoUrlProvided, isTrue);
      expect(withNull.logoUrl, isNull);
      expect(omitted.logoUrlProvided, isFalse);
    });

    test('parses tenant:opened and tenant:closed as singletons', () {
      final opened = DisplayStreamEvent.fromJson(
        jsonEncode(<String, dynamic>{'type': 'tenant:opened'}),
      );
      final closed = DisplayStreamEvent.fromJson(
        jsonEncode(<String, dynamic>{'type': 'tenant:closed'}),
      );
      expect(opened, isA<DisplayTenantOpened>());
      expect(closed, isA<DisplayTenantClosed>());
    });

    test('returns DisplayUnknownEvent for unknown types', () {
      final event = DisplayStreamEvent.fromJson(
        jsonEncode(<String, dynamic>{'type': 'party:joined'}),
      );
      expect(event, isA<DisplayUnknownEvent>());
    });

    test('returns DisplayUnknownEvent for malformed JSON', () {
      final event = DisplayStreamEvent.fromJson('not-json{');
      expect(event, isA<DisplayUnknownEvent>());
    });

    test('returns DisplayUnknownEvent for ready without tenant', () {
      final event = DisplayStreamEvent.fromJson(
        jsonEncode(<String, dynamic>{'type': 'ready'}),
      );
      expect(event, isA<DisplayUnknownEvent>());
    });
  });
}
