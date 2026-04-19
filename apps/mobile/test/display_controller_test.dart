import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/display_api.dart';
import 'package:pila/api/display_models.dart';
import 'package:pila/sse/sse_client.dart';
import 'package:pila/state/display_providers.dart';

class _FakeDisplayApi implements DisplayApi {
  _FakeDisplayApi({required this.baseUrl});

  @override
  final String baseUrl;

  final List<String> calls = <String>[];
  DisplayApiException? error;
  DisplayTokenPayload payload = const DisplayTokenPayload(
    token: 'tok-1',
    validUntilMs: 1700000000000,
    isOpen: true,
  );

  @override
  Future<DisplayTokenPayload> fetchToken(String slug) async {
    calls.add('fetch:$slug');
    if (error != null) throw error!;
    return payload;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
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

String _readyJson({bool isOpen = true}) => jsonEncode(<String, dynamic>{
      'type': 'ready',
      'tenant': <String, dynamic>{
        'name': 'Demo',
        'logoUrl': null,
        'accentColor': '#1f6feb',
        'isOpen': isOpen,
      },
    });

void main() {
  late _FakeDisplayApi api;
  late _FakeSseClient sse;

  setUp(() {
    api = _FakeDisplayApi(baseUrl: 'http://test');
    sse = _FakeSseClient();
  });

  DisplayController build() {
    return DisplayController(
      slug: 'demo',
      api: api,
      sseFactory: () => sse,
      pollInterval: const Duration(seconds: 60),
    );
  }

  test('start fetches a token and opens the SSE connection', () async {
    final controller = build();
    await controller.start();
    expect(api.calls, <String>['fetch:demo']);
    expect(sse.connectCount, 1);
    expect(controller.state.token, 'tok-1');
    expect(controller.state.joinUrl, contains('/r/demo?t=tok-1'));
    await controller.dispose();
  });

  test('ready snapshot populates tenant + flips connected=true', () async {
    final controller = build();
    await controller.start();
    await sse.emit(_readyJson());
    expect(controller.state.connected, isTrue);
    expect(controller.state.tenant?.name, 'Demo');
    expect(controller.state.tenant?.slug, 'demo');
    await controller.dispose();
  });

  test('tenant:closed flips isOpen to false without touching tenant', () async {
    final controller = build();
    await controller.start();
    await sse.emit(_readyJson());
    await sse.emit(jsonEncode(<String, dynamic>{'type': 'tenant:closed'}));
    expect(controller.state.isOpen, isFalse);
    expect(controller.state.tenant?.name, 'Demo');
    await controller.dispose();
  });

  test('tenant:opened flips isOpen + triggers a fresh token fetch', () async {
    final controller = build();
    await controller.start();
    await sse.emit(_readyJson(isOpen: false));
    api.payload = const DisplayTokenPayload(
      token: 'tok-2',
      validUntilMs: 1700000000000,
      isOpen: true,
    );
    await sse.emit(jsonEncode(<String, dynamic>{'type': 'tenant:opened'}));
    await Future<void>.delayed(const Duration(milliseconds: 5));
    expect(controller.state.isOpen, isTrue);
    expect(api.calls, containsOnce('fetch:demo'));
    expect(controller.state.token, 'tok-2');
    await controller.dispose();
  });

  test('tenant:updated merges name/accent/logo fields', () async {
    final controller = build();
    await controller.start();
    await sse.emit(_readyJson());
    await sse.emit(jsonEncode(<String, dynamic>{
      'type': 'tenant:updated',
      'name': 'New Name',
      'accentColor': '#00ff00',
    }),);
    expect(controller.state.tenant?.name, 'New Name');
    expect(controller.state.tenant?.accentColor, '#00ff00');
    await controller.dispose();
  });

  test('fetch error populates lastError + leaves connected untouched',
      () async {
    api.error = DisplayApiException(
      code: DisplayApiError.notFound,
      statusCode: 404,
    );
    final controller = build();
    await controller.start();
    expect(controller.state.lastError?.code, DisplayApiError.notFound);
    expect(controller.state.token, isNull);
    await controller.dispose();
  });
}

Matcher containsOnce(Object item) => predicate<List<String>>(
      (l) => l.where((e) => e == item).isNotEmpty,
      'contains $item at least once',
    );
