import 'dart:convert';

import '../../api/models.dart';

/// SSE event variants the guest wait stream emits. Mirrors the server TS type
/// at `lib/parties/stream-events.ts`.
sealed class GuestStreamEvent {
  const GuestStreamEvent();

  static GuestStreamEvent fromJson(String raw) {
    final map = jsonDecode(raw) as Map<String, dynamic>;
    final type = map['type'] as String;
    switch (type) {
      case 'snapshot':
        return GuestSnapshotEvent(
          status: PartyStatus.parse(map['status'] as String),
          position: (map['position'] as num).toInt(),
          name: map['name'] as String,
          joinedAt: DateTime.parse(map['joinedAt'] as String),
        );
      case 'position_changed':
        return PositionChangedEvent(
          position: (map['position'] as num).toInt(),
        );
      case 'status_changed':
        return StatusChangedEvent(
          status: PartyStatus.parse(map['status'] as String),
          resolvedAt: map['resolvedAt'] != null
              ? DateTime.parse(map['resolvedAt'] as String)
              : null,
        );
      case 'tenant:updated':
        return TenantUpdatedEvent(
          name: map['name'] as String?,
          logoUrl: map['logoUrl'] as String?,
          accentColor: map['accentColor'] as String?,
        );
      case 'tenant:opened':
        return const TenantOpenedEvent();
      case 'tenant:closed':
        return const TenantClosedEvent();
      default:
        return UnknownStreamEvent(type);
    }
  }
}

class GuestSnapshotEvent extends GuestStreamEvent {
  const GuestSnapshotEvent({
    required this.status,
    required this.position,
    required this.name,
    required this.joinedAt,
  });
  final PartyStatus status;
  final int position;
  final String name;
  final DateTime joinedAt;
}

class PositionChangedEvent extends GuestStreamEvent {
  const PositionChangedEvent({required this.position});
  final int position;
}

class StatusChangedEvent extends GuestStreamEvent {
  const StatusChangedEvent({required this.status, this.resolvedAt});
  final PartyStatus status;
  final DateTime? resolvedAt;
}

class TenantUpdatedEvent extends GuestStreamEvent {
  const TenantUpdatedEvent({this.name, this.logoUrl, this.accentColor});
  final String? name;
  final String? logoUrl;
  final String? accentColor;
}

class TenantOpenedEvent extends GuestStreamEvent {
  const TenantOpenedEvent();
}

class TenantClosedEvent extends GuestStreamEvent {
  const TenantClosedEvent();
}

class UnknownStreamEvent extends GuestStreamEvent {
  const UnknownStreamEvent(this.type);
  final String type;
}

class WaitReducerState {
  const WaitReducerState({this.wait, this.brandPatch});
  final WaitState? wait;
  final TenantBrandPatch? brandPatch;
}

class TenantBrandPatch {
  const TenantBrandPatch({
    this.name,
    this.logoUrl,
    this.accentColor,
    this.isOpen,
  });
  final String? name;
  final String? logoUrl;
  final String? accentColor;
  final bool? isOpen;
}

/// Pure reducer: given a previous state and an incoming event, compute the
/// next state without touching IO. Used by both the live controller and the
/// unit tests.
class WaitReducer {
  const WaitReducer();

  WaitReducerState apply(WaitReducerState prev, GuestStreamEvent event) {
    switch (event) {
      case GuestSnapshotEvent e:
        return WaitReducerState(
          wait: WaitState(
            status: e.status,
            position: e.position,
            name: e.name,
            joinedAt: e.joinedAt,
          ),
        );
      case PositionChangedEvent e:
        final curr = prev.wait;
        if (curr == null) return prev;
        return WaitReducerState(
          wait: curr.copyWith(position: e.position),
          brandPatch: prev.brandPatch,
        );
      case StatusChangedEvent e:
        final curr = prev.wait;
        if (curr == null) return prev;
        return WaitReducerState(
          wait: curr.copyWith(status: e.status, resolvedAt: e.resolvedAt),
          brandPatch: prev.brandPatch,
        );
      case TenantUpdatedEvent e:
        return WaitReducerState(
          wait: prev.wait,
          brandPatch: TenantBrandPatch(
            name: e.name,
            logoUrl: e.logoUrl,
            accentColor: e.accentColor,
          ),
        );
      case TenantOpenedEvent _:
        return WaitReducerState(
          wait: prev.wait,
          brandPatch: const TenantBrandPatch(isOpen: true),
        );
      case TenantClosedEvent _:
        return WaitReducerState(
          wait: prev.wait,
          brandPatch: const TenantBrandPatch(isOpen: false),
        );
      case UnknownStreamEvent _:
        return prev;
    }
  }
}
