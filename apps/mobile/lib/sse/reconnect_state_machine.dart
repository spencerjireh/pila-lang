/// Pure state machine for the SSE client. Isolated from IO so it is fully
/// unit-testable. The owning widget / controller drives transitions by
/// feeding it events.
enum SseState {
  idle,
  connecting,
  open,
  reconnecting,
  closed,
}

enum SseEvent {
  connectRequested,
  connected,
  disconnected,
  snapshotApplied,
  foregrounded,
  backgrounded,
  closeRequested,
  terminalEvent,
}

class SseTransitionError extends Error {
  SseTransitionError(this.state, this.event);
  final SseState state;
  final SseEvent event;
  @override
  String toString() => 'SseTransitionError: $event in $state';
}

class ReconnectStateMachine {
  ReconnectStateMachine();

  SseState _state = SseState.idle;
  int _attempt = 0;
  bool _snapshotNeeded = true;

  SseState get state => _state;
  int get attempt => _attempt;
  bool get snapshotNeeded => _snapshotNeeded;

  Duration nextBackoff() {
    // Exponential backoff capped at 30s: 0, 1, 2, 4, 8, 16, 30, 30, ...
    if (_attempt == 0) return Duration.zero;
    final secs = (1 << (_attempt - 1)).clamp(1, 30);
    return Duration(seconds: secs);
  }

  /// Apply [event] and return the resulting state. Throws [SseTransitionError]
  /// on illegal combinations so the controller can log and bail rather than
  /// silently drift.
  SseState apply(SseEvent event) {
    switch (_state) {
      case SseState.idle:
        if (event == SseEvent.connectRequested) return _enter(SseState.connecting);
        if (event == SseEvent.closeRequested) return _state;
        throw SseTransitionError(_state, event);

      case SseState.connecting:
        switch (event) {
          case SseEvent.connected:
            _attempt = 0;
            return _enter(SseState.open);
          case SseEvent.disconnected:
            _attempt += 1;
            return _enter(SseState.reconnecting);
          case SseEvent.closeRequested:
            return _enter(SseState.closed);
          case SseEvent.backgrounded:
            // Keep connecting silently; foreground will re-snapshot.
            _snapshotNeeded = true;
            return _state;
          default:
            throw SseTransitionError(_state, event);
        }

      case SseState.open:
        switch (event) {
          case SseEvent.snapshotApplied:
            _snapshotNeeded = false;
            return _state;
          case SseEvent.disconnected:
            _attempt += 1;
            _snapshotNeeded = true;
            return _enter(SseState.reconnecting);
          case SseEvent.backgrounded:
            _snapshotNeeded = true;
            return _state;
          case SseEvent.foregrounded:
            return _state;
          case SseEvent.terminalEvent:
          case SseEvent.closeRequested:
            return _enter(SseState.closed);
          case SseEvent.connected:
            return _state;
          default:
            throw SseTransitionError(_state, event);
        }

      case SseState.reconnecting:
        switch (event) {
          case SseEvent.connectRequested:
            return _enter(SseState.connecting);
          case SseEvent.foregrounded:
            return _enter(SseState.connecting);
          case SseEvent.closeRequested:
            return _enter(SseState.closed);
          case SseEvent.terminalEvent:
            return _enter(SseState.closed);
          case SseEvent.disconnected:
            _attempt += 1;
            return _state;
          case SseEvent.backgrounded:
            return _state;
          default:
            throw SseTransitionError(_state, event);
        }

      case SseState.closed:
        if (event == SseEvent.connectRequested) {
          _attempt = 0;
          _snapshotNeeded = true;
          return _enter(SseState.connecting);
        }
        if (event == SseEvent.closeRequested) return _state;
        throw SseTransitionError(_state, event);
    }
  }

  SseState _enter(SseState next) {
    _state = next;
    return next;
  }
}
