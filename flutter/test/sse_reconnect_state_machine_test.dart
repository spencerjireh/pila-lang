import 'package:flutter_test/flutter_test.dart';
import 'package:pila/sse/reconnect_state_machine.dart';

void main() {
  group('ReconnectStateMachine', () {
    test('starts idle and snapshot-needed', () {
      final fsm = ReconnectStateMachine();
      expect(fsm.state, SseState.idle);
      expect(fsm.snapshotNeeded, isTrue);
      expect(fsm.attempt, 0);
    });

    test('idle -> connecting -> open clears attempt', () {
      final fsm = ReconnectStateMachine();
      fsm.apply(SseEvent.connectRequested);
      expect(fsm.state, SseState.connecting);
      fsm.apply(SseEvent.connected);
      expect(fsm.state, SseState.open);
      expect(fsm.attempt, 0);
    });

    test('open -> snapshotApplied clears snapshotNeeded', () {
      final fsm = ReconnectStateMachine();
      fsm.apply(SseEvent.connectRequested);
      fsm.apply(SseEvent.connected);
      expect(fsm.snapshotNeeded, isTrue);
      fsm.apply(SseEvent.snapshotApplied);
      expect(fsm.snapshotNeeded, isFalse);
    });

    test('drop -> reconnecting -> connecting re-snapshots', () {
      final fsm = ReconnectStateMachine();
      fsm
        ..apply(SseEvent.connectRequested)
        ..apply(SseEvent.connected)
        ..apply(SseEvent.snapshotApplied);
      expect(fsm.snapshotNeeded, isFalse);

      fsm.apply(SseEvent.disconnected);
      expect(fsm.state, SseState.reconnecting);
      expect(fsm.attempt, 1);
      expect(fsm.snapshotNeeded, isTrue);

      fsm.apply(SseEvent.connectRequested);
      expect(fsm.state, SseState.connecting);
    });

    test('backoff increases then caps at 30s', () {
      final fsm = ReconnectStateMachine();
      fsm.apply(SseEvent.connectRequested);
      // 0 retries => zero
      expect(fsm.nextBackoff(), Duration.zero);

      void drop() => fsm.apply(SseEvent.disconnected);
      drop(); // attempt = 1
      expect(fsm.nextBackoff(), const Duration(seconds: 1));
      for (var i = 0; i < 10; i++) {
        drop();
      }
      final capped = fsm.nextBackoff();
      expect(capped.inSeconds, 30);
    });

    test('background in open sets snapshotNeeded but keeps open', () {
      final fsm = ReconnectStateMachine();
      fsm
        ..apply(SseEvent.connectRequested)
        ..apply(SseEvent.connected)
        ..apply(SseEvent.snapshotApplied);
      expect(fsm.snapshotNeeded, isFalse);

      fsm.apply(SseEvent.backgrounded);
      expect(fsm.state, SseState.open);
      expect(fsm.snapshotNeeded, isTrue);
    });

    test('foreground in reconnecting kicks to connecting', () {
      final fsm = ReconnectStateMachine();
      fsm
        ..apply(SseEvent.connectRequested)
        ..apply(SseEvent.connected)
        ..apply(SseEvent.disconnected);
      expect(fsm.state, SseState.reconnecting);
      fsm.apply(SseEvent.foregrounded);
      expect(fsm.state, SseState.connecting);
    });

    test('terminal event closes from open and from reconnecting', () {
      final fsm = ReconnectStateMachine();
      fsm
        ..apply(SseEvent.connectRequested)
        ..apply(SseEvent.connected)
        ..apply(SseEvent.terminalEvent);
      expect(fsm.state, SseState.closed);

      final fsm2 = ReconnectStateMachine();
      fsm2
        ..apply(SseEvent.connectRequested)
        ..apply(SseEvent.connected)
        ..apply(SseEvent.disconnected)
        ..apply(SseEvent.terminalEvent);
      expect(fsm2.state, SseState.closed);
    });

    test('connectRequested re-initializes from closed', () {
      final fsm = ReconnectStateMachine();
      fsm
        ..apply(SseEvent.connectRequested)
        ..apply(SseEvent.connected)
        ..apply(SseEvent.disconnected)
        ..apply(SseEvent.closeRequested);
      expect(fsm.state, SseState.closed);
      fsm.apply(SseEvent.connectRequested);
      expect(fsm.state, SseState.connecting);
      expect(fsm.attempt, 0);
      expect(fsm.snapshotNeeded, isTrue);
    });

    test('illegal transitions throw', () {
      final fsm = ReconnectStateMachine();
      expect(
        () => fsm.apply(SseEvent.connected),
        throwsA(isA<SseTransitionError>()),
      );
    });
  });
}
