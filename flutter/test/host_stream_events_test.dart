import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/host_models.dart';
import 'package:pila/api/models.dart';

void main() {
  group('HostStreamEvent.fromJson', () {
    test('parses a snapshot into a HostSnapshot payload', () {
      final raw = jsonEncode(<String, dynamic>{
        'type': 'snapshot',
        'tenant': <String, dynamic>{
          'slug': 'demo',
          'name': 'Demo',
          'isOpen': true,
          'logoUrl': null,
          'accentColor': '#1F6FEB',
          'timezone': 'Asia/Kolkata',
        },
        'waiting': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'p1',
            'name': 'Priya',
            'partySize': 2,
            'phone': null,
            'joinedAt': '2026-04-19T11:00:00.000Z',
          },
        ],
        'recentlyResolved': <Map<String, dynamic>>[
          <String, dynamic>{
            'id': 'p2',
            'name': 'Bob',
            'partySize': 3,
            'status': 'seated',
            'resolvedAt': '2026-04-19T11:20:00.000Z',
          },
        ],
      });
      final event = HostStreamEvent.fromJson(raw);
      expect(event, isA<HostSnapshotReceived>());
      final snapshot = (event as HostSnapshotReceived).snapshot;
      expect(snapshot.tenant.slug, 'demo');
      expect(snapshot.tenant.timezone, 'Asia/Kolkata');
      expect(snapshot.waiting, hasLength(1));
      expect(snapshot.waiting.first.name, 'Priya');
      expect(snapshot.recentlyResolved, hasLength(1));
      expect(snapshot.recentlyResolved.first.status, PartyStatus.seated);
    });

    test('parses party:joined into HostPartyJoined', () {
      final raw = jsonEncode(<String, dynamic>{
        'type': 'party:joined',
        'id': 'p9',
        'name': 'Zia',
        'partySize': 4,
        'phone': '+15550001',
        'joinedAt': '2026-04-19T11:05:00.000Z',
      });
      final event = HostStreamEvent.fromJson(raw);
      expect(event, isA<HostPartyJoined>());
      final joined = event as HostPartyJoined;
      expect(joined.id, 'p9');
      expect(joined.partySize, 4);
      expect(joined.phone, '+15550001');
    });

    test('parses party:seated/removed/left into HostPartyResolved', () {
      for (final wire in <String>['party:seated', 'party:removed', 'party:left']) {
        final status = wire == 'party:seated'
            ? 'seated'
            : wire == 'party:removed'
                ? 'no_show'
                : 'left';
        final raw = jsonEncode(<String, dynamic>{
          'type': wire,
          'id': 'p1',
          'status': status,
          'resolvedAt': '2026-04-19T11:20:00.000Z',
        });
        final event = HostStreamEvent.fromJson(raw);
        expect(event, isA<HostPartyResolved>(), reason: wire);
        expect((event as HostPartyResolved).status, PartyStatus.parse(status));
      }
    });

    test('parses party:restored into HostPartyRestored', () {
      final raw = jsonEncode(<String, dynamic>{
        'type': 'party:restored',
        'id': 'p1',
        'name': 'Priya',
        'partySize': 2,
        'phone': null,
        'joinedAt': '2026-04-19T11:00:00.000Z',
      });
      final event = HostStreamEvent.fromJson(raw);
      expect(event, isA<HostPartyRestored>());
    });

    test('parses tenant:opened/closed/reset as dedicated events', () {
      expect(
        HostStreamEvent.fromJson(jsonEncode(<String, dynamic>{'type': 'tenant:opened'})),
        isA<HostTenantOpened>(),
      );
      expect(
        HostStreamEvent.fromJson(jsonEncode(<String, dynamic>{'type': 'tenant:closed'})),
        isA<HostTenantClosed>(),
      );
      expect(
        HostStreamEvent.fromJson(jsonEncode(<String, dynamic>{'type': 'tenant:reset'})),
        isA<HostTenantReset>(),
      );
    });

    test('tenant:updated surfaces the patch fields', () {
      final raw = jsonEncode(<String, dynamic>{
        'type': 'tenant:updated',
        'name': 'Renamed',
        'accentColor': '#AA0000',
      });
      final event = HostStreamEvent.fromJson(raw);
      expect(event, isA<HostTenantUpdated>());
      final patch = event as HostTenantUpdated;
      expect(patch.name, 'Renamed');
      expect(patch.accentColor, '#AA0000');
      expect(patch.logoUrlProvided, isFalse);
    });

    test('tenant:updated distinguishes logoUrl=null from omitted', () {
      final cleared = HostStreamEvent.fromJson(
        jsonEncode(<String, dynamic>{
          'type': 'tenant:updated',
          'logoUrl': null,
        }),
      ) as HostTenantUpdated;
      expect(cleared.logoUrlProvided, isTrue);
      expect(cleared.logoUrl, isNull);
    });

    test('unknown or malformed payloads fall through to HostUnknownEvent', () {
      expect(
        HostStreamEvent.fromJson('not-json'),
        isA<HostUnknownEvent>(),
      );
      expect(
        HostStreamEvent.fromJson(jsonEncode(<String, dynamic>{'type': 'mystery'})),
        isA<HostUnknownEvent>(),
      );
    });
  });

  group('HostSnapshot encode/decode', () {
    test('round-trips through JSON without loss', () {
      final original = HostSnapshot(
        tenant: const HostTenantBrand(
          slug: 'demo',
          name: 'Demo',
          logoUrl: null,
          accentColor: '#1F6FEB',
          isOpen: true,
          timezone: 'UTC',
        ),
        waiting: <HostWaitingRow>[
          HostWaitingRow(
            id: 'w1',
            name: 'A',
            partySize: 2,
            joinedAt: DateTime.utc(2026, 4, 19, 11),
          ),
        ],
        recentlyResolved: <HostRecentlyResolvedRow>[
          HostRecentlyResolvedRow(
            id: 'r1',
            name: 'B',
            partySize: 3,
            status: PartyStatus.seated,
            resolvedAt: DateTime.utc(2026, 4, 19, 11, 20),
          ),
        ],
      );
      final decoded = HostSnapshot.decode(original.encode());
      expect(decoded.tenant.slug, 'demo');
      expect(decoded.tenant.timezone, 'UTC');
      expect(decoded.waiting.first.joinedAt, original.waiting.first.joinedAt);
      expect(
        decoded.recentlyResolved.first.status,
        PartyStatus.seated,
      );
    });
  });
}
