import 'dart:convert';

import 'models.dart';

/// Payload returned by `GET /api/display/<slug>/token`.
class DisplayTokenPayload {
  const DisplayTokenPayload({
    required this.token,
    required this.validUntilMs,
    required this.isOpen,
  });

  final String token;
  final int validUntilMs;
  final bool isOpen;

  factory DisplayTokenPayload.fromJson(Map<String, dynamic> json) {
    return DisplayTokenPayload(
      token: json['token'] as String,
      validUntilMs: (json['validUntilMs'] as num).toInt(),
      isOpen: json['isOpen'] as bool,
    );
  }
}

/// Discriminated union matching the SSE payloads from
/// `app/api/display/[slug]/stream/route.ts` (display subset).
sealed class DisplayStreamEvent {
  const DisplayStreamEvent();

  factory DisplayStreamEvent.fromJson(String raw) {
    Object? decoded;
    try {
      decoded = jsonDecode(raw);
    } on FormatException {
      return DisplayUnknownEvent(raw);
    }
    if (decoded is! Map<String, dynamic>) {
      return DisplayUnknownEvent(raw);
    }
    final type = decoded['type'] as String?;
    switch (type) {
      case 'ready':
        final tenantJson = decoded['tenant'] as Map<String, dynamic>?;
        if (tenantJson == null) return DisplayUnknownEvent(raw);
        return DisplayReady(
          tenant: TenantBrand(
            slug: tenantJson['slug'] as String? ?? '',
            name: tenantJson['name'] as String,
            logoUrl: tenantJson['logoUrl'] as String?,
            accentColor: tenantJson['accentColor'] as String,
            isOpen: tenantJson['isOpen'] as bool,
          ),
        );
      case 'tenant:updated':
        return DisplayTenantUpdated(
          name: decoded['name'] as String?,
          logoUrl: decoded.containsKey('logoUrl')
              ? decoded['logoUrl'] as String?
              : null,
          logoUrlProvided: decoded.containsKey('logoUrl'),
          accentColor: decoded['accentColor'] as String?,
        );
      case 'tenant:opened':
        return const DisplayTenantOpened();
      case 'tenant:closed':
        return const DisplayTenantClosed();
      default:
        return DisplayUnknownEvent(raw);
    }
  }
}

class DisplayReady extends DisplayStreamEvent {
  const DisplayReady({required this.tenant});
  final TenantBrand tenant;
}

class DisplayTenantUpdated extends DisplayStreamEvent {
  const DisplayTenantUpdated({
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

class DisplayTenantOpened extends DisplayStreamEvent {
  const DisplayTenantOpened();
}

class DisplayTenantClosed extends DisplayStreamEvent {
  const DisplayTenantClosed();
}

class DisplayUnknownEvent extends DisplayStreamEvent {
  const DisplayUnknownEvent(this.raw);
  final String raw;
}
