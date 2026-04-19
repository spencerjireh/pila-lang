import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/display_api.dart';
import '../api/display_models.dart';
import '../api/models.dart';
import '../config/env.dart';
import '../sse/sse_client.dart';

final displayApiProvider = Provider<DisplayApi>((ref) {
  return DisplayApi(baseUrl: PilaEnv.apiBaseUrl);
});

const Duration kDisplayTokenPollInterval = Duration(seconds: 60);

class DisplayState {
  const DisplayState({
    this.tenant,
    this.isOpen = true,
    this.token,
    this.validUntilMs,
    this.joinUrl,
    this.connected = false,
    this.fetching = false,
    this.lastError,
  });

  final TenantBrand? tenant;
  final bool isOpen;
  final String? token;
  final int? validUntilMs;
  final String? joinUrl;
  final bool connected;
  final bool fetching;
  final DisplayApiException? lastError;

  DisplayState copyWith({
    TenantBrand? tenant,
    bool? isOpen,
    String? token,
    int? validUntilMs,
    String? joinUrl,
    bool? connected,
    bool? fetching,
    DisplayApiException? lastError,
    bool clearError = false,
  }) {
    return DisplayState(
      tenant: tenant ?? this.tenant,
      isOpen: isOpen ?? this.isOpen,
      token: token ?? this.token,
      validUntilMs: validUntilMs ?? this.validUntilMs,
      joinUrl: joinUrl ?? this.joinUrl,
      connected: connected ?? this.connected,
      fetching: fetching ?? this.fetching,
      lastError: clearError ? null : (lastError ?? this.lastError),
    );
  }
}

class DisplayController extends StateNotifier<DisplayState> {
  DisplayController({
    required this.slug,
    required DisplayApi api,
    SseClient Function()? sseFactory,
    Duration pollInterval = kDisplayTokenPollInterval,
  })  : _api = api,
        _pollInterval = pollInterval,
        _sseFactory = sseFactory ?? (() => _buildLive(slug)),
        super(const DisplayState());

  final String slug;
  final DisplayApi _api;
  final Duration _pollInterval;
  final SseClient Function() _sseFactory;

  SseClient? _client;
  StreamSubscription<SseMessage>? _sub;
  Timer? _pollTimer;
  bool _started = false;

  static SseClient _buildLive(String slug) {
    return SseClient(
      url: Uri.parse('${PilaEnv.apiBaseUrl}/api/display/$slug/stream'),
      authHeader: () async => <String, String>{},
    );
  }

  Future<void> start() async {
    if (_started) return;
    _started = true;
    await _refreshToken();
    _startSse();
    _armPollTimer();
  }

  void _armPollTimer() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(_pollInterval, (_) => _refreshToken());
  }

  Future<void> _refreshToken() async {
    if (state.fetching) return;
    state = state.copyWith(fetching: true, clearError: true);
    try {
      final payload = await _api.fetchToken(slug);
      final joinUrl =
          '${PilaEnv.apiBaseUrl}/r/$slug?t=${Uri.encodeComponent(payload.token)}';
      state = state.copyWith(
        token: payload.token,
        validUntilMs: payload.validUntilMs,
        joinUrl: joinUrl,
        isOpen: payload.isOpen,
        fetching: false,
      );
    } on DisplayApiException catch (err) {
      state = state.copyWith(fetching: false, lastError: err);
    }
  }

  void _startSse() {
    if (_client != null) return;
    final client = _sseFactory();
    _client = client;
    _sub = client.messages.listen(_onMessage, onError: _onSseError);
    client.connect();
  }

  void _onMessage(SseMessage msg) {
    DisplayStreamEvent event;
    try {
      event = DisplayStreamEvent.fromJson(msg.data);
    } catch (_) {
      return;
    }
    state = state.copyWith(connected: true, clearError: true);
    switch (event) {
      case DisplayReady(:final tenant):
        state = state.copyWith(
          tenant: TenantBrand(
            slug: slug,
            name: tenant.name,
            logoUrl: tenant.logoUrl,
            accentColor: tenant.accentColor,
            isOpen: tenant.isOpen,
          ),
          isOpen: tenant.isOpen,
        );
      case DisplayTenantUpdated(
            :final name,
            :final logoUrl,
            :final logoUrlProvided,
            :final accentColor,
          ):
        final prev = state.tenant;
        if (prev == null) return;
        state = state.copyWith(
          tenant: TenantBrand(
            slug: prev.slug,
            name: name ?? prev.name,
            logoUrl: logoUrlProvided ? logoUrl : prev.logoUrl,
            accentColor: accentColor ?? prev.accentColor,
            isOpen: prev.isOpen,
          ),
        );
      case DisplayTenantClosed():
        state = state.copyWith(isOpen: false);
      case DisplayTenantOpened():
        state = state.copyWith(isOpen: true);
        unawaited(_refreshToken());
      case DisplayUnknownEvent():
        return;
    }
  }

  void _onSseError(Object err) {
    state = state.copyWith(connected: false);
  }

  void onForegrounded() {
    _client?.onForegrounded();
    unawaited(_refreshToken());
  }

  void onBackgrounded() {
    _client?.onBackgrounded();
  }

  @override
  Future<void> dispose() async {
    _pollTimer?.cancel();
    await _sub?.cancel();
    await _client?.close();
    super.dispose();
  }
}

/// Family-indexed provider: one controller per slug. The controller
/// auto-starts (fetch + SSE + poll timer) the first time it is watched.
final displayControllerProvider =
    StateNotifierProvider.family<DisplayController, DisplayState, String>(
  (ref, slug) {
    final api = ref.watch(displayApiProvider);
    final controller = DisplayController(slug: slug, api: api);
    controller.start();
    return controller;
  },
);
