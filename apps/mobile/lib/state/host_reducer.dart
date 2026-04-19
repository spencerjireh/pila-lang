import '../api/host_models.dart';

/// Pure reducer applying a single [HostStreamEvent] to the current
/// [HostSnapshot]. The controller owns persistence + UI notification;
/// this function has no side effects and is fully unit-testable.
class HostReducer {
  const HostReducer();

  HostSnapshot? apply(HostSnapshot? prev, HostStreamEvent event) {
    switch (event) {
      case HostSnapshotReceived e:
        return e.snapshot;
      case HostPartyJoined e:
        if (prev == null) return null;
        if (prev.waiting.any((w) => w.id == e.id)) return prev;
        final next = <HostWaitingRow>[
          ...prev.waiting,
          HostWaitingRow(
            id: e.id,
            name: e.name,
            partySize: e.partySize,
            phone: e.phone,
            joinedAt: e.joinedAt,
          ),
        ]..sort((a, b) => a.joinedAt.compareTo(b.joinedAt));
        return prev.copyWith(waiting: next);
      case HostPartyResolved e:
        if (prev == null) return null;
        final removed = prev.waiting.where((w) => w.id == e.id).toList();
        if (removed.isEmpty) return prev;
        final row = removed.first;
        final waiting =
            prev.waiting.where((w) => w.id != e.id).toList(growable: false);
        final resolvedRow = HostRecentlyResolvedRow(
          id: row.id,
          name: row.name,
          partySize: row.partySize,
          status: e.status,
          resolvedAt: e.resolvedAt,
        );
        final recentlyResolved = <HostRecentlyResolvedRow>[
          resolvedRow,
          ...prev.recentlyResolved.where((r) => r.id != e.id),
        ];
        return prev.copyWith(
          waiting: waiting,
          recentlyResolved: recentlyResolved,
        );
      case HostPartyRestored e:
        if (prev == null) return null;
        final remainingResolved = prev.recentlyResolved
            .where((r) => r.id != e.id)
            .toList(growable: false);
        final waiting = <HostWaitingRow>[
          ...prev.waiting.where((w) => w.id != e.id),
          HostWaitingRow(
            id: e.id,
            name: e.name,
            partySize: e.partySize,
            phone: e.phone,
            joinedAt: e.joinedAt,
          ),
        ]..sort((a, b) => a.joinedAt.compareTo(b.joinedAt));
        return prev.copyWith(
          waiting: waiting,
          recentlyResolved: remainingResolved,
        );
      case HostTenantOpened _:
        if (prev == null) return null;
        return prev.copyWith(tenant: prev.tenant.copyWith(isOpen: true));
      case HostTenantClosed _:
        if (prev == null) return null;
        return prev.copyWith(tenant: prev.tenant.copyWith(isOpen: false));
      case HostTenantReset _:
        if (prev == null) return null;
        return prev.copyWith(
          waiting: const <HostWaitingRow>[],
          recentlyResolved: const <HostRecentlyResolvedRow>[],
        );
      case HostTenantUpdated e:
        if (prev == null) return null;
        return prev.copyWith(
          tenant: prev.tenant.copyWith(
            name: e.name,
            accentColor: e.accentColor,
            logoUrl: e.logoUrlProvided ? e.logoUrl : null,
            clearLogo: e.logoUrlProvided && e.logoUrl == null,
          ),
        );
      case HostUnknownEvent _:
        return prev;
    }
  }
}
