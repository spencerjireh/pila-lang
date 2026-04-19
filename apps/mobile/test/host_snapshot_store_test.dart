import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/host_models.dart';
import 'package:pila/api/models.dart';
import 'package:pila/persistence/host_snapshot_store.dart';

HostSnapshot _snapshot({String slug = 'demo'}) {
  return HostSnapshot(
    tenant: HostTenantBrand(
      slug: slug,
      name: 'Demo',
      logoUrl: null,
      accentColor: '#1F6FEB',
      isOpen: true,
      timezone: 'UTC',
    ),
    waiting: <HostWaitingRow>[
      HostWaitingRow(
        id: 'w1',
        name: 'Alice',
        partySize: 2,
        joinedAt: DateTime.utc(2026, 4, 19, 11),
      ),
    ],
    recentlyResolved: <HostRecentlyResolvedRow>[
      HostRecentlyResolvedRow(
        id: 'r1',
        name: 'Bob',
        partySize: 3,
        status: PartyStatus.seated,
        resolvedAt: DateTime.utc(2026, 4, 19, 11, 20),
      ),
    ],
  );
}

void main() {
  group('InMemoryHostSnapshotStore', () {
    test('save then load returns the same snapshot', () async {
      final store = InMemoryHostSnapshotStore();
      final original = _snapshot();
      final updatedAt = DateTime.utc(2026, 4, 19, 11, 30);
      await store.save('demo', original, updatedAt: updatedAt);
      final loaded = await store.load('demo');
      expect(loaded, isNotNull);
      expect(loaded!.updatedAt, updatedAt);
      expect(loaded.snapshot.tenant.slug, 'demo');
      expect(loaded.snapshot.waiting.first.name, 'Alice');
      expect(loaded.snapshot.recentlyResolved.first.status, PartyStatus.seated);
    });

    test('load returns null for an unknown slug', () async {
      final store = InMemoryHostSnapshotStore();
      expect(await store.load('missing'), isNull);
    });

    test('save overwrites an existing slug', () async {
      final store = InMemoryHostSnapshotStore();
      await store.save('demo', _snapshot());
      final next = _snapshot().copyWith(
        waiting: <HostWaitingRow>[],
      );
      await store.save('demo', next);
      final loaded = await store.load('demo');
      expect(loaded!.snapshot.waiting, isEmpty);
    });

    test('delete removes one slug', () async {
      final store = InMemoryHostSnapshotStore();
      await store.save('demo', _snapshot());
      await store.save('other', _snapshot(slug: 'other'));
      await store.delete('demo');
      expect(await store.load('demo'), isNull);
      expect(await store.load('other'), isNotNull);
    });
  });

  group('isHostSnapshotStale', () {
    test('returns false just inside the threshold', () {
      final now = DateTime.utc(2026, 4, 19, 12);
      final updatedAt = now.subtract(kHostSnapshotStaleAfter - const Duration(seconds: 1));
      expect(isHostSnapshotStale(updatedAt, now: now), isFalse);
    });

    test('returns true past the threshold', () {
      final now = DateTime.utc(2026, 4, 19, 12);
      final updatedAt = now.subtract(kHostSnapshotStaleAfter + const Duration(seconds: 1));
      expect(isHostSnapshotStale(updatedAt, now: now), isTrue);
    });
  });
}
