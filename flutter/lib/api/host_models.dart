import 'dart:convert';

import 'models.dart';

class HostTenantBrand {
  const HostTenantBrand({
    required this.slug,
    required this.name,
    required this.logoUrl,
    required this.accentColor,
    required this.isOpen,
    required this.timezone,
  });

  final String slug;
  final String name;
  final String? logoUrl;
  final String accentColor;
  final bool isOpen;
  final String timezone;

  /// Project the host-side brand into the tenant-agnostic [TenantBrand]
  /// shape consumed by shared widgets (e.g. [TenantHeader]).
  TenantBrand asTenantBrand() {
    return TenantBrand(
      slug: slug,
      name: name,
      logoUrl: logoUrl,
      accentColor: accentColor,
      isOpen: isOpen,
    );
  }

  HostTenantBrand copyWith({
    String? name,
    String? logoUrl,
    bool clearLogo = false,
    String? accentColor,
    bool? isOpen,
    String? timezone,
  }) {
    return HostTenantBrand(
      slug: slug,
      name: name ?? this.name,
      logoUrl: clearLogo ? null : (logoUrl ?? this.logoUrl),
      accentColor: accentColor ?? this.accentColor,
      isOpen: isOpen ?? this.isOpen,
      timezone: timezone ?? this.timezone,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'slug': slug,
        'name': name,
        'logoUrl': logoUrl,
        'accentColor': accentColor,
        'isOpen': isOpen,
        'timezone': timezone,
      };

  factory HostTenantBrand.fromJson(Map<String, dynamic> json) {
    return HostTenantBrand(
      slug: json['slug'] as String,
      name: json['name'] as String,
      logoUrl: json['logoUrl'] as String?,
      accentColor: json['accentColor'] as String,
      isOpen: json['isOpen'] as bool,
      timezone: json['timezone'] as String? ?? 'UTC',
    );
  }
}

class HostWaitingRow {
  const HostWaitingRow({
    required this.id,
    required this.name,
    required this.partySize,
    required this.joinedAt,
    this.phone,
  });

  final String id;
  final String name;
  final int partySize;
  final String? phone;
  final DateTime joinedAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'name': name,
        'partySize': partySize,
        'phone': phone,
        'joinedAt': joinedAt.toIso8601String(),
      };

  factory HostWaitingRow.fromJson(Map<String, dynamic> json) {
    return HostWaitingRow(
      id: json['id'] as String,
      name: json['name'] as String,
      partySize: (json['partySize'] as num).toInt(),
      phone: json['phone'] as String?,
      joinedAt: DateTime.parse(json['joinedAt'] as String),
    );
  }
}

class HostRecentlyResolvedRow {
  const HostRecentlyResolvedRow({
    required this.id,
    required this.name,
    required this.partySize,
    required this.status,
    required this.resolvedAt,
  });

  final String id;
  final String name;
  final int partySize;
  final PartyStatus status;
  final DateTime resolvedAt;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'id': id,
        'name': name,
        'partySize': partySize,
        'status': status.wire,
        'resolvedAt': resolvedAt.toIso8601String(),
      };

  factory HostRecentlyResolvedRow.fromJson(Map<String, dynamic> json) {
    return HostRecentlyResolvedRow(
      id: json['id'] as String,
      name: json['name'] as String,
      partySize: (json['partySize'] as num).toInt(),
      status: PartyStatus.parse(json['status'] as String),
      resolvedAt: DateTime.parse(json['resolvedAt'] as String),
    );
  }
}

class HostSnapshot {
  const HostSnapshot({
    required this.tenant,
    required this.waiting,
    required this.recentlyResolved,
  });

  final HostTenantBrand tenant;
  final List<HostWaitingRow> waiting;
  final List<HostRecentlyResolvedRow> recentlyResolved;

  HostSnapshot copyWith({
    HostTenantBrand? tenant,
    List<HostWaitingRow>? waiting,
    List<HostRecentlyResolvedRow>? recentlyResolved,
  }) {
    return HostSnapshot(
      tenant: tenant ?? this.tenant,
      waiting: waiting ?? this.waiting,
      recentlyResolved: recentlyResolved ?? this.recentlyResolved,
    );
  }

  Map<String, dynamic> toJson() => <String, dynamic>{
        'tenant': tenant.toJson(),
        'waiting': waiting.map((w) => w.toJson()).toList(),
        'recentlyResolved':
            recentlyResolved.map((r) => r.toJson()).toList(),
      };

  String encode() => jsonEncode(toJson());

  factory HostSnapshot.fromJson(Map<String, dynamic> json) {
    return HostSnapshot(
      tenant:
          HostTenantBrand.fromJson(json['tenant'] as Map<String, dynamic>),
      waiting: (json['waiting'] as List<dynamic>)
          .map((w) => HostWaitingRow.fromJson(w as Map<String, dynamic>))
          .toList(),
      recentlyResolved: (json['recentlyResolved'] as List<dynamic>)
          .map((r) =>
              HostRecentlyResolvedRow.fromJson(r as Map<String, dynamic>),)
          .toList(),
    );
  }

  factory HostSnapshot.decode(String raw) =>
      HostSnapshot.fromJson(jsonDecode(raw) as Map<String, dynamic>);
}

/// Discriminated union matching the SSE payloads from
/// `lib/parties/stream-events.ts` (host subset).
sealed class HostStreamEvent {
  const HostStreamEvent();

  factory HostStreamEvent.fromJson(String raw) {
    Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } on FormatException {
      return HostUnknownEvent(raw);
    }
    if (decoded is! Map<String, dynamic>) {
      return HostUnknownEvent(raw);
    }
    final type = decoded['type'] as String?;
    switch (type) {
      case 'snapshot':
        return HostSnapshotReceived(HostSnapshot.fromJson(decoded));
      case 'party:joined':
        return HostPartyJoined(
          id: decoded['id'] as String,
          name: decoded['name'] as String,
          partySize: (decoded['partySize'] as num).toInt(),
          phone: decoded['phone'] as String?,
          joinedAt: DateTime.parse(decoded['joinedAt'] as String),
        );
      case 'party:seated':
      case 'party:removed':
      case 'party:left':
        return HostPartyResolved(
          id: decoded['id'] as String,
          status: PartyStatus.parse(decoded['status'] as String),
          resolvedAt: DateTime.parse(decoded['resolvedAt'] as String),
        );
      case 'party:restored':
        return HostPartyRestored(
          id: decoded['id'] as String,
          name: decoded['name'] as String,
          partySize: (decoded['partySize'] as num).toInt(),
          phone: decoded['phone'] as String?,
          joinedAt: DateTime.parse(decoded['joinedAt'] as String),
        );
      case 'tenant:opened':
        return const HostTenantOpened();
      case 'tenant:closed':
        return const HostTenantClosed();
      case 'tenant:reset':
        return const HostTenantReset();
      case 'tenant:updated':
        return HostTenantUpdated(
          name: decoded['name'] as String?,
          logoUrl: decoded.containsKey('logoUrl')
              ? decoded['logoUrl'] as String?
              : null,
          logoUrlProvided: decoded.containsKey('logoUrl'),
          accentColor: decoded['accentColor'] as String?,
        );
      default:
        return HostUnknownEvent(raw);
    }
  }
}

class HostSnapshotReceived extends HostStreamEvent {
  const HostSnapshotReceived(this.snapshot);
  final HostSnapshot snapshot;
}

class HostPartyJoined extends HostStreamEvent {
  const HostPartyJoined({
    required this.id,
    required this.name,
    required this.partySize,
    required this.joinedAt,
    this.phone,
  });
  final String id;
  final String name;
  final int partySize;
  final String? phone;
  final DateTime joinedAt;
}

class HostPartyResolved extends HostStreamEvent {
  const HostPartyResolved({
    required this.id,
    required this.status,
    required this.resolvedAt,
  });
  final String id;
  final PartyStatus status;
  final DateTime resolvedAt;
}

class HostPartyRestored extends HostStreamEvent {
  const HostPartyRestored({
    required this.id,
    required this.name,
    required this.partySize,
    required this.joinedAt,
    this.phone,
  });
  final String id;
  final String name;
  final int partySize;
  final String? phone;
  final DateTime joinedAt;
}

class HostTenantOpened extends HostStreamEvent {
  const HostTenantOpened();
}

class HostTenantClosed extends HostStreamEvent {
  const HostTenantClosed();
}

class HostTenantReset extends HostStreamEvent {
  const HostTenantReset();
}

class HostTenantUpdated extends HostStreamEvent {
  const HostTenantUpdated({
    this.name,
    this.logoUrl,
    this.logoUrlProvided = false,
    this.accentColor,
  });
  final String? name;
  final String? logoUrl;
  final bool logoUrlProvided;
  final String? accentColor;
}

class HostUnknownEvent extends HostStreamEvent {
  const HostUnknownEvent(this.raw);
  final String raw;
}

class HostBearerResponse {
  const HostBearerResponse({
    required this.token,
    required this.expiresIn,
    required this.slug,
  });
  final String token;
  final int expiresIn;
  final String slug;

  factory HostBearerResponse.fromJson(Map<String, dynamic> json) {
    return HostBearerResponse(
      token: json['token'] as String,
      expiresIn: (json['expiresIn'] as num).toInt(),
      slug: json['slug'] as String,
    );
  }
}

class UndoResponse {
  const UndoResponse({required this.partyId, required this.action});
  final String partyId;
  final String action;

  factory UndoResponse.fromJson(Map<String, dynamic> json) {
    return UndoResponse(
      partyId: json['partyId'] as String,
      action: json['action'] as String,
    );
  }
}

class GuestHistoryRow {
  const GuestHistoryRow({
    required this.phone,
    required this.lastName,
    required this.visitCount,
    required this.lastVisitAt,
  });
  final String phone;
  final String lastName;
  final int visitCount;
  final DateTime lastVisitAt;

  factory GuestHistoryRow.fromJson(Map<String, dynamic> json) {
    return GuestHistoryRow(
      phone: json['phone'] as String,
      lastName: json['lastName'] as String,
      visitCount: (json['visitCount'] as num).toInt(),
      lastVisitAt: DateTime.parse(json['lastVisitAt'] as String),
    );
  }
}

class GuestHistoryPage {
  const GuestHistoryPage({required this.rows, required this.nextCursor});
  final List<GuestHistoryRow> rows;
  final String? nextCursor;

  factory GuestHistoryPage.fromJson(Map<String, dynamic> json) {
    return GuestHistoryPage(
      rows: (json['rows'] as List<dynamic>)
          .map((r) => GuestHistoryRow.fromJson(r as Map<String, dynamic>))
          .toList(),
      nextCursor: json['nextCursor'] as String?,
    );
  }
}
