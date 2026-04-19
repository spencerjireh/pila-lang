import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import 'reconnect_state_machine.dart';

class SseMessage {
  SseMessage({required this.event, required this.data});
  final String event;
  final String data;
}

typedef AuthHeader = Future<Map<String, String>> Function();

/// Thin SSE client built on streamed HTTP. Consumes
/// [ReconnectStateMachine] for state transitions; foreground re-snapshot is
/// the owning controller's job.
class SseClient {
  SseClient({
    required this.url,
    required this.authHeader,
    http.Client? client,
  })  : _client = client ?? http.Client(),
        _fsm = ReconnectStateMachine();

  final Uri url;
  final AuthHeader authHeader;
  final http.Client _client;
  final ReconnectStateMachine _fsm;

  final _controller = StreamController<SseMessage>.broadcast();
  http.StreamedResponse? _response;
  StreamSubscription<String>? _sub;
  bool _disposed = false;

  Stream<SseMessage> get messages => _controller.stream;
  SseState get state => _fsm.state;

  Future<void> connect() async {
    if (_disposed) return;
    _fsm.apply(SseEvent.connectRequested);
    try {
      final req = http.Request('GET', url);
      req.headers['Accept'] = 'text/event-stream';
      req.headers.addAll(await authHeader());
      _response = await _client.send(req);
      if (_response!.statusCode != 200) {
        _fsm.apply(SseEvent.disconnected);
        _scheduleRetry();
        return;
      }
      _fsm.apply(SseEvent.connected);
      _sub = _response!.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen(
            _onLine,
            onDone: _onDisconnect,
            onError: (_) => _onDisconnect(),
            cancelOnError: true,
          );
    } catch (_) {
      _fsm.apply(SseEvent.disconnected);
      _scheduleRetry();
    }
  }

  String _event = '';
  final StringBuffer _data = StringBuffer();

  void _onLine(String line) {
    if (line.isEmpty) {
      if (_event.isNotEmpty || _data.isNotEmpty) {
        _controller.add(SseMessage(event: _event, data: _data.toString()));
      }
      _event = '';
      _data.clear();
      return;
    }
    if (line.startsWith('event:')) {
      _event = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      if (_data.isNotEmpty) _data.writeln();
      _data.write(line.substring(5).trimLeft());
    }
  }

  void _onDisconnect() {
    _fsm.apply(SseEvent.disconnected);
    _sub?.cancel();
    _sub = null;
    if (!_disposed) _scheduleRetry();
  }

  void _scheduleRetry() {
    final backoff = _fsm.nextBackoff();
    Timer(backoff, () {
      if (_disposed) return;
      connect();
    });
  }

  void onForegrounded() {
    _fsm.apply(SseEvent.foregrounded);
    if (_fsm.snapshotNeeded) {
      _sub?.cancel();
      connect();
    }
  }

  void onBackgrounded() {
    _fsm.apply(SseEvent.backgrounded);
  }

  Future<void> close() async {
    _disposed = true;
    _fsm.apply(SseEvent.closeRequested);
    await _sub?.cancel();
    await _controller.close();
    _client.close();
  }
}
