import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/host_api.dart';
import 'package:pila/api/host_models.dart';
import 'package:pila/auth/bearer_storage.dart';
import 'package:pila/persistence/host_snapshot_store.dart';
import 'package:pila/sse/sse_client.dart';
import 'package:pila/state/host_providers.dart';

class _FakeHostApi implements HostApi {
  _FakeHostApi();

  final List<String> calls = <String>[];
  HostApiException? error;

  void _maybeThrow(String tag) {
    calls.add(tag);
    if (error != null) throw error!;
  }

  @override
  Future<DateTime> seat({required String slug, required String partyId}) async {
    _maybeThrow('seat:$slug:$partyId');
    return DateTime.utc(2026, 4, 19, 12);
  }

  @override
  Future<DateTime> removeParty({
    required String slug,
    required String partyId,
  }) async {
    _maybeThrow('remove:$slug:$partyId');
    return DateTime.utc(2026, 4, 19, 12);
  }

  @override
  Future<UndoResponse> undo(String slug) async {
    _maybeThrow('undo:$slug');
    return const UndoResponse(partyId: 'p1', action: 'seat');
  }

  @override
  Future<bool> openQueue(String slug) async {
    _maybeThrow('open:$slug');
    return true;
  }

  @override
  Future<bool> closeQueue(String slug) async {
    _maybeThrow('close:$slug');
    return false;
  }

  @override
  Future<HostBearerResponse> exchangeToken({
    required String slug,
    required String password,
  }) => throw UnimplementedError();

  @override
  Future<void> logout(String slug) async => _maybeThrow('logout:$slug');

  @override
  Future<void> clearLogo(String slug) async => _maybeThrow('clearLogo:$slug');

  @override
  Future<Map<String, dynamic>> updateGeneral({
    required String slug,
    String? name,
    String? accentColor,
  }) async {
    _maybeThrow('updateGeneral:$slug');
    return <String, dynamic>{};
  }

  @override
  Future<String?> uploadLogo({
    required String slug,
    required dynamic file,
    required String filename,
    required String mimeType,
  }) =>
      throw UnimplementedError();

  @override
  Future<int> rotatePassword({
    required String slug,
    required String newPassword,
  }) async {
    _maybeThrow('rotate:$slug');
    return 2;
  }

  @override
  Future<int> logoutOthers(String slug) async {
    _maybeThrow('logoutOthers:$slug');
    return 2;
  }

  @override
  Future<GuestHistoryPage> listGuests({
    required String slug,
    String? cursor,
    int? limit,
  }) async {
    _maybeThrow('listGuests:$slug');
    return const GuestHistoryPage(rows: <GuestHistoryRow>[], nextCursor: null);
  }
}

class _FakeSseClient implements SseClient {
  _FakeSseClient();

  final StreamController<SseMessage> _controller =
      StreamController<SseMessage>.broadcast();
  int connectCount = 0;
  bool closed = false;

  @override
  Stream<SseMessage> get messages => _controller.stream;

  @override
  Future<void> connect() async {
    connectCount++;
  }

  @override
  Future<void> close() async {
    closed = true;
    await _controller.close();
  }

  @override
  void onForegrounded() {}

  @override
  void onBackgrounded() {}

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);

  Future<void> emit(String data) async {
    _controller.add(SseMessage(event: '', data: data));
    await Future<void>.delayed(Duration.zero);
  }
}

String _snapshotJson() => jsonEncode(<String, dynamic>{
      'type': 'snapshot',
      'tenant': <String, dynamic>{
        'slug': 'demo',
        'name': 'Demo',
        'isOpen': true,
        'logoUrl': null,
        'accentColor': '#1F6FEB',
        'timezone': 'UTC',
      },
      'waiting': <Map<String, dynamic>>[
        <String, dynamic>{
          'id': 'p1',
          'name': 'Priya',
          'partySize': 2,
          'phone': null,
          'joinedAt': '2026-04-19T11:00:00.000Z',
        },
      ],
      'recentlyResolved': <Map<String, dynamic>>[],
    });

void main() {
  late _FakeHostApi api;
  late InMemoryHostSnapshotStore store;
  late InMemoryBearerStorage storage;
  late _FakeSseClient sse;

  setUp(() {
    api = _FakeHostApi();
    store = InMemoryHostSnapshotStore();
    storage = InMemoryBearerStorage();
    sse = _FakeSseClient();
  });

  HostQueueController build({DateTime Function()? clock}) {
    return HostQueueController(
      slug: 'demo',
      api: api,
      store: store,
      storage: storage,
      sseFactory: () => sse,
      clock: clock,
    );
  }

  test('start hydrates from the snapshot store before connecting', () async {
    await store.save(
      'demo',
      const HostSnapshot(
        tenant: HostTenantBrand(
          slug: 'demo',
          name: 'Cached',
          logoUrl: null,
          accentColor: '#111111',
          isOpen: true,
          timezone: 'UTC',
        ),
        waiting: <HostWaitingRow>[],
        recentlyResolved: <HostRecentlyResolvedRow>[],
      ),
      updatedAt: DateTime.utc(2026, 4, 19, 11, 59),
    );
    final controller = build(clock: () => DateTime.utc(2026, 4, 19, 12));
    await controller.start();
    expect(controller.state.snapshot?.tenant.name, 'Cached');
    expect(controller.state.connected, isFalse);
    expect(controller.state.stale, isFalse);
    await controller.dispose();
  });

  test('marks cached snapshot stale when updatedAt is past the threshold',
      () async {
    await store.save(
      'demo',
      const HostSnapshot(
        tenant: HostTenantBrand(
          slug: 'demo',
          name: 'Cached',
          logoUrl: null,
          accentColor: '#111111',
          isOpen: true,
          timezone: 'UTC',
        ),
        waiting: <HostWaitingRow>[],
        recentlyResolved: <HostRecentlyResolvedRow>[],
      ),
      updatedAt: DateTime.utc(2026, 4, 19, 11, 55),
    );
    final controller = build(clock: () => DateTime.utc(2026, 4, 19, 12));
    await controller.start();
    expect(controller.state.stale, isTrue);
    await controller.dispose();
  });

  test('a snapshot message flips connected=true + persists to the store',
      () async {
    final controller = build();
    await controller.start();
    await sse.emit(_snapshotJson());
    expect(controller.state.connected, isTrue);
    expect(controller.state.snapshot?.waiting.first.id, 'p1');
    final stored = await store.load('demo');
    expect(stored, isNotNull);
    expect(stored!.snapshot.waiting.first.id, 'p1');
    await controller.dispose();
  });

  test('seat calls the API and surfaces a success toast', () async {
    final controller = build();
    await controller.start();
    await sse.emit(_snapshotJson());
    await controller.seat('p1');
    expect(api.calls.any((c) => c.startsWith('seat:demo:p1')), isTrue);
    expect(controller.state.lastToast?.isError, isFalse);
    expect(controller.state.lastToast?.message, 'Seated');
    expect(controller.state.pendingAction, isNull);
    await controller.dispose();
  });

  test('actions are suppressed when the stream is not connected', () async {
    final controller = build();
    await controller.start();
    await controller.seat('p1');
    expect(api.calls, isEmpty);
    await controller.dispose();
  });

  test('API errors surface as lastError + error toast', () async {
    final controller = build();
    await controller.start();
    await sse.emit(_snapshotJson());
    api.error = HostApiException(
      code: HostApiError.tooLateToUndo,
      statusCode: 409,
      message: 'too_old',
    );
    await controller.undo();
    expect(controller.state.lastError?.code, HostApiError.tooLateToUndo);
    expect(controller.state.lastToast?.isError, isTrue);
    await controller.dispose();
  });

  test('toggleOpenClose picks close or open from the snapshot', () async {
    final controller = build();
    await controller.start();
    await sse.emit(_snapshotJson());
    await controller.toggleOpenClose();
    expect(api.calls.any((c) => c.startsWith('close:')), isTrue);
    await controller.dispose();
  });
}
