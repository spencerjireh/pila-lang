import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/host_models.dart';
import 'package:pila/api/models.dart';
import 'package:pila/domain/host/host_reducer.dart';

const _reducer = HostReducer();

HostSnapshot _snapshot({
  List<HostWaitingRow> waiting = const <HostWaitingRow>[],
  List<HostRecentlyResolvedRow> resolved = const <HostRecentlyResolvedRow>[],
  bool isOpen = true,
  String name = 'Demo',
  String? logoUrl,
  String accentColor = '#1F6FEB',
}) {
  return HostSnapshot(
    tenant: HostTenantBrand(
      slug: 'demo',
      name: name,
      logoUrl: logoUrl,
      accentColor: accentColor,
      isOpen: isOpen,
      timezone: 'UTC',
    ),
    waiting: waiting,
    recentlyResolved: resolved,
  );
}

HostWaitingRow _w(String id, {int seconds = 0}) {
  return HostWaitingRow(
    id: id,
    name: 'Name$id',
    partySize: 2,
    joinedAt: DateTime.utc(2026, 4, 19, 11).add(Duration(seconds: seconds)),
  );
}

void main() {
  group('HostReducer.apply', () {
    test('snapshot replaces prior state entirely', () {
      final initial = _snapshot(waiting: <HostWaitingRow>[_w('old')]);
      final fresh = _snapshot(waiting: <HostWaitingRow>[_w('new')]);
      final next =
          _reducer.apply(initial, HostSnapshotReceived(fresh));
      expect(next, same(fresh));
    });

    test('party:joined appends to waiting in joinedAt order', () {
      final now = DateTime.utc(2026, 4, 19, 11);
      final snap = _snapshot(waiting: <HostWaitingRow>[_w('a'), _w('b', seconds: 30)]);
      final event = HostPartyJoined(
        id: 'c',
        name: 'Carol',
        partySize: 4,
        joinedAt: now.add(const Duration(seconds: 15)),
      );
      final next = _reducer.apply(snap, event)!;
      expect(next.waiting.map((w) => w.id), ['a', 'c', 'b']);
    });

    test('party:joined is a no-op when the id is already in waiting', () {
      final snap = _snapshot(waiting: <HostWaitingRow>[_w('a')]);
      final event = HostPartyJoined(
        id: 'a',
        name: 'Duplicate',
        partySize: 99,
        joinedAt: DateTime.utc(2026, 4, 19, 11, 1),
      );
      final next = _reducer.apply(snap, event)!;
      expect(next.waiting.first.name, 'Namea');
      expect(next.waiting, hasLength(1));
    });

    test('party:seated moves the row from waiting to recentlyResolved', () {
      final snap = _snapshot(waiting: <HostWaitingRow>[_w('a'), _w('b', seconds: 30)]);
      final event = HostPartyResolved(
        id: 'a',
        status: PartyStatus.seated,
        resolvedAt: DateTime.utc(2026, 4, 19, 11, 10),
      );
      final next = _reducer.apply(snap, event)!;
      expect(next.waiting.map((w) => w.id), ['b']);
      expect(next.recentlyResolved, hasLength(1));
      expect(next.recentlyResolved.first.id, 'a');
      expect(next.recentlyResolved.first.status, PartyStatus.seated);
    });

    test('party:removed maps to no_show status', () {
      final snap = _snapshot(waiting: <HostWaitingRow>[_w('a')]);
      final event = HostPartyResolved(
        id: 'a',
        status: PartyStatus.noShow,
        resolvedAt: DateTime.utc(2026, 4, 19, 11, 11),
      );
      final next = _reducer.apply(snap, event)!;
      expect(next.recentlyResolved.first.status, PartyStatus.noShow);
    });

    test('party:restored moves row back to waiting and drops from resolved', () {
      final row = HostRecentlyResolvedRow(
        id: 'a',
        name: 'Alice',
        partySize: 2,
        status: PartyStatus.seated,
        resolvedAt: DateTime.utc(2026, 4, 19, 11, 5),
      );
      final snap = _snapshot(resolved: <HostRecentlyResolvedRow>[row]);
      final event = HostPartyRestored(
        id: 'a',
        name: 'Alice',
        partySize: 2,
        joinedAt: DateTime.utc(2026, 4, 19, 11),
      );
      final next = _reducer.apply(snap, event)!;
      expect(next.waiting, hasLength(1));
      expect(next.waiting.first.id, 'a');
      expect(next.recentlyResolved, isEmpty);
    });

    test('tenant:opened + tenant:closed flip isOpen', () {
      final closed = _snapshot(isOpen: false);
      final opened =
          _reducer.apply(closed, const HostTenantOpened())!;
      expect(opened.tenant.isOpen, isTrue);
      final reclosed =
          _reducer.apply(opened, const HostTenantClosed())!;
      expect(reclosed.tenant.isOpen, isFalse);
    });

    test('tenant:reset clears both lists but keeps the tenant', () {
      final snap = _snapshot(
        waiting: <HostWaitingRow>[_w('a')],
        resolved: <HostRecentlyResolvedRow>[
          HostRecentlyResolvedRow(
            id: 'r',
            name: 'R',
            partySize: 1,
            status: PartyStatus.seated,
            resolvedAt: DateTime.utc(2026, 4, 19, 11),
          ),
        ],
      );
      final next =
          _reducer.apply(snap, const HostTenantReset())!;
      expect(next.waiting, isEmpty);
      expect(next.recentlyResolved, isEmpty);
      expect(next.tenant.slug, 'demo');
    });

    test('tenant:updated merges provided fields only', () {
      final snap = _snapshot(name: 'Old', accentColor: '#111111', logoUrl: 'x');
      const event = HostTenantUpdated(
        name: 'New',
        accentColor: '#AA0000',
      );
      final next = _reducer.apply(snap, event)!;
      expect(next.tenant.name, 'New');
      expect(next.tenant.accentColor, '#AA0000');
      expect(next.tenant.logoUrl, 'x');
    });

    test('tenant:updated with logoUrl=null clears the logo when provided', () {
      final snap = _snapshot(logoUrl: 'abc');
      const event = HostTenantUpdated(
        logoUrl: null,
        logoUrlProvided: true,
      );
      final next = _reducer.apply(snap, event)!;
      expect(next.tenant.logoUrl, isNull);
    });

    test('unknown events pass through unchanged', () {
      final snap = _snapshot();
      final next = _reducer.apply(snap, const HostUnknownEvent('?'))!;
      expect(identical(next, snap), isTrue);
    });

    test('events before any snapshot leave state null', () {
      expect(
        _reducer.apply(
          null,
          HostPartyJoined(
            id: 'a',
            name: 'A',
            partySize: 1,
            joinedAt: DateTime.utc(2026, 4, 19, 11),
          ),
        ),
        isNull,
      );
    });
  });
}
