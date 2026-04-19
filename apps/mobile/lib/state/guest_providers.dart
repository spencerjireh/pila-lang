import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/guest_api.dart';
import '../api/models.dart';
import '../auth/bearer_storage.dart';
import '../auth/http_client.dart';
import '../config/env.dart';
import '../persistence/party_store.dart';
import '../sse/sse_client.dart';
import 'wait_reducer.dart';

/// Bearer storage. Production: secure storage; tests override with in-memory.
final bearerStorageProvider = Provider<BearerStorage>((ref) {
  return SecureBearerStorage();
});

/// Party store. Override with [InMemoryPartyStore] in tests.
final partyStoreProvider = Provider<PartyStore>((ref) {
  throw UnimplementedError(
    'partyStoreProvider must be overridden at app startup '
    '(SqflitePartyStore.open for prod, InMemoryPartyStore for tests)',
  );
});

/// Authed dio client; forwards bearer + reacts to refresh/401.
final guestApiProvider = Provider<GuestApi>((ref) {
  final storage = ref.watch(bearerStorageProvider);
  final dio = buildAuthedClient(
    baseUrl: PilaEnv.apiBaseUrl,
    storage: storage,
    scope: BearerScope.guest,
  );
  return GuestApi(authed: dio, baseUrl: PilaEnv.apiBaseUrl);
});

class CurrentSession {
  const CurrentSession({required this.slug, required this.partyId});
  final String slug;
  final String partyId;
}

/// The party the user is currently tracking. Null when no session exists.
final currentSessionProvider = StateProvider<CurrentSession?>((ref) => null);

class WaitScreenState {
  const WaitScreenState({
    this.wait,
    this.brandPatch,
    this.connected = false,
    this.error,
  });
  final WaitState? wait;
  final TenantBrandPatch? brandPatch;
  final bool connected;
  final String? error;

  WaitScreenState copyWith({
    WaitState? wait,
    TenantBrandPatch? brandPatch,
    bool? connected,
    String? error,
    bool clearError = false,
  }) {
    return WaitScreenState(
      wait: wait ?? this.wait,
      brandPatch: brandPatch ?? this.brandPatch,
      connected: connected ?? this.connected,
      error: clearError ? null : (error ?? this.error),
    );
  }
}

/// Controller wiring the SSE client to the [WaitReducer]. Exposed as a
/// StateNotifier for widgets to watch via Riverpod.
class WaitController extends StateNotifier<WaitScreenState> {
  WaitController({
    required this.slug,
    required this.partyId,
    required BearerStorage storage,
    SseClient Function()? sseFactory,
  })  : _sseFactory = sseFactory ?? (() => _buildLive(slug, partyId, storage)),
        super(const WaitScreenState());

  final String slug;
  final String partyId;
  final SseClient Function() _sseFactory;
  final WaitReducer _reducer = const WaitReducer();
  SseClient? _client;
  StreamSubscription<SseMessage>? _sub;

  static SseClient _buildLive(
    String slug,
    String partyId,
    BearerStorage storage,
  ) {
    return SseClient(
      url: Uri.parse(
        '${PilaEnv.apiBaseUrl}/api/r/$slug/parties/$partyId/stream',
      ),
      authHeader: () async {
        final token = await storage.read(BearerScope.guest);
        return <String, String>{
          if (token != null) 'Authorization': 'Bearer $token',
        };
      },
    );
  }

  void start() {
    if (_client != null) return;
    final client = _sseFactory();
    _client = client;
    _sub = client.messages.listen(_onMessage, onError: _onError);
    client.connect();
  }

  void _onMessage(SseMessage msg) {
    try {
      final event = GuestStreamEvent.fromJson(msg.data);
      final next = _reducer.apply(
        WaitReducerState(wait: state.wait, brandPatch: state.brandPatch),
        event,
      );
      state = state.copyWith(
        wait: next.wait,
        brandPatch: next.brandPatch,
        connected: true,
        clearError: true,
      );
    } catch (err) {
      state = state.copyWith(error: 'parse_failure');
    }
  }

  void _onError(Object err) {
    state = state.copyWith(connected: false);
  }

  void onForegrounded() {
    _client?.onForegrounded();
  }

  void onBackgrounded() {
    _client?.onBackgrounded();
  }

  Future<void> seed(WaitState state) async {
    this.state = this.state.copyWith(wait: state);
  }

  @override
  Future<void> dispose() async {
    await _sub?.cancel();
    await _client?.close();
    super.dispose();
  }
}

/// Family-indexed provider: one WaitController per (slug, partyId) pair.
final waitControllerProvider =
    StateNotifierProvider.family<WaitController, WaitScreenState, CurrentSession>(
  (ref, session) {
    final storage = ref.watch(bearerStorageProvider);
    return WaitController(
      slug: session.slug,
      partyId: session.partyId,
      storage: storage,
    );
  },
);
