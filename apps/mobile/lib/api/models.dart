/// Lifecycle states a party can be in. Mirrors the server enum in
/// `lib/db/schema.ts`.
enum PartyStatus {
  waiting,
  seated,
  noShow,
  left,
  cancelled;

  static PartyStatus parse(String raw) {
    switch (raw) {
      case 'waiting':
        return PartyStatus.waiting;
      case 'seated':
        return PartyStatus.seated;
      case 'no_show':
        return PartyStatus.noShow;
      case 'left':
        return PartyStatus.left;
      case 'cancelled':
        return PartyStatus.cancelled;
      default:
        throw ArgumentError('unknown party status: $raw');
    }
  }

  String get wire {
    switch (this) {
      case PartyStatus.waiting:
        return 'waiting';
      case PartyStatus.seated:
        return 'seated';
      case PartyStatus.noShow:
        return 'no_show';
      case PartyStatus.left:
        return 'left';
      case PartyStatus.cancelled:
        return 'cancelled';
    }
  }

  bool get isTerminal => this != PartyStatus.waiting;
}

enum TokenStatus { ok, expired, invalid, missing, unchecked }

TokenStatus parseTokenStatus(String raw) {
  switch (raw) {
    case 'ok':
      return TokenStatus.ok;
    case 'expired':
      return TokenStatus.expired;
    case 'invalid':
      return TokenStatus.invalid;
    case 'missing':
      return TokenStatus.missing;
    case 'unchecked':
      return TokenStatus.unchecked;
    default:
      throw ArgumentError('unknown token status: $raw');
  }
}

class TenantBrand {
  const TenantBrand({
    required this.slug,
    required this.name,
    required this.logoUrl,
    required this.accentColor,
    required this.isOpen,
  });

  final String slug;
  final String name;
  final String? logoUrl;
  final String accentColor;
  final bool isOpen;

  TenantBrand copyWith({
    String? name,
    String? logoUrl,
    String? accentColor,
    bool? isOpen,
  }) {
    return TenantBrand(
      slug: slug,
      name: name ?? this.name,
      logoUrl: logoUrl ?? this.logoUrl,
      accentColor: accentColor ?? this.accentColor,
      isOpen: isOpen ?? this.isOpen,
    );
  }
}

class GuestInfoResponse {
  const GuestInfoResponse({required this.brand, required this.tokenStatus});
  final TenantBrand brand;
  final TokenStatus tokenStatus;

  factory GuestInfoResponse.fromJson(String slug, Map<String, dynamic> json) {
    return GuestInfoResponse(
      brand: TenantBrand(
        slug: slug,
        name: json['name'] as String,
        logoUrl: json['logoUrl'] as String?,
        accentColor: json['accentColor'] as String,
        isOpen: json['isOpen'] as bool,
      ),
      tokenStatus: parseTokenStatus(json['tokenStatus'] as String),
    );
  }
}

class JoinInput {
  const JoinInput({required this.name, required this.partySize, this.phone});
  final String name;
  final int partySize;
  final String? phone;

  Map<String, dynamic> toJson() => <String, dynamic>{
        'name': name,
        'partySize': partySize,
        'phone': phone,
      };
}

class JoinResponse {
  const JoinResponse({required this.partyId, required this.waitUrl});
  final String partyId;
  final String waitUrl;

  factory JoinResponse.fromJson(Map<String, dynamic> json) {
    return JoinResponse(
      partyId: json['partyId'] as String,
      waitUrl: json['waitUrl'] as String,
    );
  }
}

class GuestBearerResponse {
  const GuestBearerResponse({
    required this.token,
    required this.expiresIn,
    required this.slug,
    required this.partyId,
  });
  final String token;
  final int expiresIn;
  final String slug;
  final String partyId;

  factory GuestBearerResponse.fromJson(Map<String, dynamic> json) {
    return GuestBearerResponse(
      token: json['token'] as String,
      expiresIn: (json['expiresIn'] as num).toInt(),
      slug: json['slug'] as String,
      partyId: json['partyId'] as String,
    );
  }
}

class WaitState {
  const WaitState({
    required this.status,
    required this.position,
    required this.name,
    required this.joinedAt,
    this.resolvedAt,
  });

  final PartyStatus status;
  final int position;
  final String name;
  final DateTime joinedAt;
  final DateTime? resolvedAt;

  WaitState copyWith({
    PartyStatus? status,
    int? position,
    DateTime? resolvedAt,
  }) {
    return WaitState(
      status: status ?? this.status,
      position: position ?? this.position,
      name: name,
      joinedAt: joinedAt,
      resolvedAt: resolvedAt ?? this.resolvedAt,
    );
  }
}
