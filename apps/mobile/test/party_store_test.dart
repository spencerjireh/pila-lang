import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/models.dart';
import 'package:pila/persistence/party_store.dart';

GuestPartyRecord _sample({
  String slug = 'demo',
  String partyId = 'p-1',
  String tenantName = 'Demo Diner',
  PartyStatus status = PartyStatus.waiting,
  DateTime? updatedAt,
  DateTime? resolvedAt,
}) {
  final now = DateTime.utc(2026, 4, 19, 12, 0);
  return GuestPartyRecord(
    slug: slug,
    partyId: partyId,
    tenantName: tenantName,
    name: 'Alice',
    partySize: 2,
    joinedAt: now,
    status: status,
    resolvedAt: resolvedAt,
    updatedAt: updatedAt ?? now,
  );
}

void main() {
  late PartyStore store;

  setUp(() {
    store = InMemoryPartyStore();
  });

  test('upsert then findByParty returns the record', () async {
    await store.upsert(_sample());
    final found = await store.findByParty('demo', 'p-1');
    expect(found, isNotNull);
    expect(found!.name, 'Alice');
    expect(found.status, PartyStatus.waiting);
  });

  test('findByParty returns null for unknown (slug, partyId)', () async {
    final found = await store.findByParty('demo', 'unknown');
    expect(found, isNull);
  });

  test('upsert replaces existing row and persists terminal state', () async {
    await store.upsert(_sample());
    final resolved = DateTime.utc(2026, 4, 19, 12, 30);
    await store.upsert(
      _sample(
        status: PartyStatus.seated,
        resolvedAt: resolved,
        updatedAt: resolved,
      ),
    );
    final found = await store.findByParty('demo', 'p-1');
    expect(found!.status, PartyStatus.seated);
    expect(found.resolvedAt, resolved);
  });

  test('latestForSlug returns the most recently updated row', () async {
    final older = _sample(
      partyId: 'p-1',
      updatedAt: DateTime.utc(2026, 4, 19, 12, 0),
    );
    final newer = _sample(
      partyId: 'p-2',
      updatedAt: DateTime.utc(2026, 4, 19, 12, 10),
    );
    await store.upsert(older);
    await store.upsert(newer);
    final found = await store.latestForSlug('demo');
    expect(found!.partyId, 'p-2');
  });

  test('latestForSlug ignores rows from other slugs', () async {
    await store.upsert(_sample(slug: 'other'));
    final found = await store.latestForSlug('demo');
    expect(found, isNull);
  });

  test('delete removes the (slug, partyId) row', () async {
    await store.upsert(_sample());
    await store.delete('demo', 'p-1');
    final found = await store.findByParty('demo', 'p-1');
    expect(found, isNull);
  });

  test('clear removes every row', () async {
    await store.upsert(_sample(partyId: 'p-1'));
    await store.upsert(_sample(partyId: 'p-2'));
    await store.clear();
    final found = await store.latestForSlug('demo');
    expect(found, isNull);
  });

  test('upsert round-trips tenantName', () async {
    await store.upsert(_sample(tenantName: 'Garden Table'));
    final found = await store.findByParty('demo', 'p-1');
    expect(found!.tenantName, 'Garden Table');
  });

  group('latestWaiting', () {
    test('returns null when the store is empty', () async {
      expect(await store.latestWaiting(), isNull);
    });

    test('returns null when every row is terminal', () async {
      await store.upsert(_sample(status: PartyStatus.seated));
      await store.upsert(
        _sample(partyId: 'p-2', status: PartyStatus.left),
      );
      expect(await store.latestWaiting(), isNull);
    });

    test('ignores terminal rows and returns the waiting one', () async {
      await store.upsert(_sample(status: PartyStatus.seated));
      await store.upsert(
        _sample(partyId: 'p-2', status: PartyStatus.waiting),
      );
      final found = await store.latestWaiting();
      expect(found!.partyId, 'p-2');
    });

    test('returns the most recently updated waiting row across slugs',
        () async {
      await store.upsert(
        _sample(
          slug: 'alpha',
          partyId: 'p-1',
          updatedAt: DateTime.utc(2026, 4, 19, 12, 0),
        ),
      );
      await store.upsert(
        _sample(
          slug: 'beta',
          partyId: 'p-2',
          updatedAt: DateTime.utc(2026, 4, 19, 12, 10),
        ),
      );
      final found = await store.latestWaiting();
      expect(found!.slug, 'beta');
    });
  });
}
