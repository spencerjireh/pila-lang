import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/host_api.dart';
import '../api/host_models.dart';
import '../auth/bearer_storage.dart';
import '../auth/http_client.dart';
import '../config/env.dart';
import '../persistence/host_snapshot_store.dart';
import '../sse/sse_client.dart';
import '../state/guest_providers.dart' show bearerStorageProvider;
import 'host_reducer.dart';

final hostSnapshotStoreProvider = Provider<HostSnapshotStore>((ref) {
  throw UnimplementedError(
    'hostSnapshotStoreProvider must be overridden at app startup '
    '(SqfliteHostSnapshotStore.open for prod, InMemoryHostSnapshotStore for tests)',
  );
});

final hostApiProvider = Provider<HostApi>((ref) {
  final storage = ref.watch(bearerStorageProvider);
  final dio = buildAuthedClient(
    baseUrl: PilaEnv.apiBaseUrl,
    storage: storage,
    scope: BearerScope.host,
  );
  return HostApi(authed: dio, baseUrl: PilaEnv.apiBaseUrl);
});

/// Holds the host-bearer presence as a [Listenable] the router can
/// use for `refreshListenable`. Sync access to the current value keeps
/// GoRouter's redirect honest without awaiting secure storage.
final hostAuthControllerProvider = Provider<HostAuthController>((ref) {
  final storage = ref.watch(bearerStorageProvider);
  final controller = HostAuthController(storage: storage);
  controller.sync();
  return controller;
});

class HostAuthController extends ChangeNotifier {
  HostAuthController({required BearerStorage storage}) : _storage = storage;

  final BearerStorage _storage;
  bool _authed = false;

  bool get authed => _authed;

  Future<void> sync() async {
    final token = await _storage.read(BearerScope.host);
    _set(token != null && token.isNotEmpty);
  }

  Future<void> adopt(String token) async {
    await _storage.write(BearerScope.host, token);
    _set(true);
  }

  Future<void> signOut() async {
    await _storage.clear(BearerScope.host);
    _set(false);
  }

  void _set(bool next) {
    if (_authed == next) return;
    _authed = next;
    notifyListeners();
  }
}

enum HostActionKind { seat, remove, undo, openToggle }

class HostQueueState {
  const HostQueueState({
    this.snapshot,
    this.connected = false,
    this.stale = false,
    this.pendingAction,
    this.lastError,
    this.lastToast,
  });

  final HostSnapshot? snapshot;
  final bool connected;
  final bool stale;
  final HostActionKind? pendingAction;
  final HostApiException? lastError;
  final HostToast? lastToast;

  bool get canAct => connected && !stale && pendingAction == null;

  HostQueueState copyWith({
    HostSnapshot? snapshot,
    bool? connected,
    bool? stale,
    HostActionKind? pendingAction,
    bool clearPending = false,
    HostApiException? lastError,
    bool clearError = false,
    HostToast? lastToast,
    bool clearToast = false,
  }) {
    return HostQueueState(
      snapshot: snapshot ?? this.snapshot,
      connected: connected ?? this.connected,
      stale: stale ?? this.stale,
      pendingAction:
          clearPending ? null : (pendingAction ?? this.pendingAction),
      lastError: clearError ? null : (lastError ?? this.lastError),
      lastToast: clearToast ? null : (lastToast ?? this.lastToast),
    );
  }
}

class HostToast {
  HostToast.success({
    required this.message,
    required this.partyId,
    required this.kind,
    this.canUndo = true,
  })  : isError = false,
        spawnedAt = DateTime.now();
  HostToast.error({required this.message})
      : isError = true,
        partyId = null,
        kind = null,
        canUndo = false,
        spawnedAt = DateTime.now();

  final String message;
  final bool isError;
  final String? partyId;
  final HostActionKind? kind;
  final bool canUndo;
  final DateTime spawnedAt;
}

class HostQueueController extends StateNotifier<HostQueueState> {
  HostQueueController({
    required this.slug,
    required HostApi api,
    required HostSnapshotStore store,
    required BearerStorage storage,
    SseClient Function()? sseFactory,
    DateTime Function()? clock,
  })  : _api = api,
        _store = store,
        _clock = clock ?? DateTime.now,
        _sseFactory = sseFactory ??
            (() => _buildLive(slug: slug, storage: storage)),
        super(const HostQueueState());

  final String slug;
  final HostApi _api;
  final HostSnapshotStore _store;
  final DateTime Function() _clock;
  final SseClient Function() _sseFactory;
  final HostReducer _reducer = const HostReducer();

  SseClient? _client;
  StreamSubscription<SseMessage>? _sub;
  Timer? _staleTicker;

  static SseClient _buildLive({
    required String slug,
    required BearerStorage storage,
  }) {
    return SseClient(
      url: Uri.parse('${PilaEnv.apiBaseUrl}/api/host/$slug/queue/stream'),
      authHeader: () async {
        final token = await storage.read(BearerScope.host);
        return <String, String>{
          if (token != null) 'Authorization': 'Bearer $token',
        };
      },
    );
  }

  Future<void> start() async {
    final cached = await _store.load(slug);
    if (cached != null) {
      state = state.copyWith(
        snapshot: cached.snapshot,
        stale: isHostSnapshotStale(cached.updatedAt, now: _clock()),
      );
    }
    _armStaleTicker();
    _startSse();
  }

  void _startSse() {
    if (_client != null) return;
    final client = _sseFactory();
    _client = client;
    _sub = client.messages.listen(_onMessage, onError: _onSseError);
    client.connect();
  }

  void _onMessage(SseMessage msg) {
    HostStreamEvent event;
    try {
      event = HostStreamEvent.fromJson(msg.data);
    } catch (_) {
      return;
    }
    final nextSnapshot = _reducer.apply(state.snapshot, event);
    final now = _clock();
    if (nextSnapshot != null) {
      _store.save(slug, nextSnapshot, updatedAt: now);
    }
    state = state.copyWith(
      snapshot: nextSnapshot ?? state.snapshot,
      connected: true,
      stale: false,
      clearError: true,
    );
  }

  void _onSseError(Object err) {
    state = state.copyWith(connected: false);
  }

  void _armStaleTicker() {
    _staleTicker?.cancel();
    _staleTicker = Timer.periodic(const Duration(seconds: 30), (_) {
      _evaluateStaleness();
    });
  }

  void _evaluateStaleness() {
    final snap = state.snapshot;
    if (snap == null) return;
    final cachedAt = _clock();
    // We don't persist the last event time in state; rely on the store.
    _store.load(slug).then((stored) {
      if (stored == null) return;
      final isStale = isHostSnapshotStale(stored.updatedAt, now: cachedAt);
      if (isStale != state.stale) {
        state = state.copyWith(stale: isStale);
      }
    });
  }

  void onForegrounded() {
    _client?.onForegrounded();
    _evaluateStaleness();
  }

  void onBackgrounded() {
    _client?.onBackgrounded();
  }

  Future<void> seat(String partyId) async {
    await _runAction(HostActionKind.seat, partyId: partyId, call: () async {
      await _api.seat(slug: slug, partyId: partyId);
    }, toast: 'Seated',);
  }

  Future<void> removeParty(String partyId) async {
    await _runAction(HostActionKind.remove, partyId: partyId, call: () async {
      await _api.removeParty(slug: slug, partyId: partyId);
    }, toast: 'Removed',);
  }

  Future<void> undo() async {
    await _runAction(
      HostActionKind.undo,
      call: () async => _api.undo(slug),
      toast: 'Undone',
      canUndo: false,
    );
  }

  Future<void> toggleOpenClose() async {
    final snap = state.snapshot;
    if (snap == null) return;
    await _runAction(HostActionKind.openToggle, call: () async {
      if (snap.tenant.isOpen) {
        await _api.closeQueue(slug);
      } else {
        await _api.openQueue(slug);
      }
    }, toast: snap.tenant.isOpen ? 'Closed' : 'Reopened', canUndo: false,);
  }

  Future<void> _runAction(
    HostActionKind kind, {
    required Future<void> Function() call,
    required String toast,
    String? partyId,
    bool canUndo = true,
  }) async {
    if (!state.canAct) return;
    state = state.copyWith(pendingAction: kind, clearError: true);
    try {
      await call();
      state = state.copyWith(
        clearPending: true,
        clearError: true,
        lastToast: HostToast.success(
          message: toast,
          partyId: partyId,
          kind: kind,
          canUndo: canUndo,
        ),
      );
    } on HostApiException catch (err) {
      state = state.copyWith(
        clearPending: true,
        lastError: err,
        lastToast: HostToast.error(message: err.message ?? err.code.name),
      );
    }
  }

  void clearToast() {
    state = state.copyWith(clearToast: true);
  }

  @override
  Future<void> dispose() async {
    _staleTicker?.cancel();
    await _sub?.cancel();
    await _client?.close();
    super.dispose();
  }
}

/// Family-indexed provider: one controller per slug.
final hostQueueControllerProvider = StateNotifierProvider.family<
    HostQueueController, HostQueueState, String>((ref, slug) {
  final api = ref.watch(hostApiProvider);
  final store = ref.watch(hostSnapshotStoreProvider);
  final storage = ref.watch(bearerStorageProvider);
  final controller = HostQueueController(
    slug: slug,
    api: api,
    store: store,
    storage: storage,
  );
  controller.start();
  return controller;
});
