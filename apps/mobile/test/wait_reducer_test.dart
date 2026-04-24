import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/models.dart';
import 'package:pila/domain/wait/wait_reducer.dart';

WaitReducerState _empty() => const WaitReducerState();

void main() {
  const reducer = WaitReducer();

  test('snapshot seeds wait state', () {
    final event = GuestStreamEvent.fromJson(
      '{"type":"snapshot","status":"waiting","position":3,"name":"Alice",'
      '"joinedAt":"2026-04-19T12:00:00.000Z"}',
    );
    final next = reducer.apply(_empty(), event);
    expect(next.wait, isNotNull);
    expect(next.wait!.position, 3);
    expect(next.wait!.status, PartyStatus.waiting);
    expect(next.wait!.name, 'Alice');
  });

  test('position_changed updates position but preserves name/joinedAt', () {
    final snap = GuestStreamEvent.fromJson(
      '{"type":"snapshot","status":"waiting","position":3,"name":"Alice",'
      '"joinedAt":"2026-04-19T12:00:00.000Z"}',
    );
    final after = reducer.apply(_empty(), snap);
    final evt = GuestStreamEvent.fromJson(
      '{"type":"position_changed","position":1}',
    );
    final next = reducer.apply(after, evt);
    expect(next.wait!.position, 1);
    expect(next.wait!.name, 'Alice');
    expect(next.wait!.joinedAt.toIso8601String(), '2026-04-19T12:00:00.000Z');
  });

  test('status_changed carries resolvedAt and transitions to terminal', () {
    final snap = GuestStreamEvent.fromJson(
      '{"type":"snapshot","status":"waiting","position":1,"name":"Alice",'
      '"joinedAt":"2026-04-19T12:00:00.000Z"}',
    );
    final after = reducer.apply(_empty(), snap);
    final evt = GuestStreamEvent.fromJson(
      '{"type":"status_changed","status":"seated",'
      '"resolvedAt":"2026-04-19T12:30:00.000Z"}',
    );
    final next = reducer.apply(after, evt);
    expect(next.wait!.status, PartyStatus.seated);
    expect(next.wait!.resolvedAt, isNotNull);
    expect(next.wait!.status.isTerminal, isTrue);
  });

  test('position_changed with no prior wait is a no-op', () {
    final evt = GuestStreamEvent.fromJson(
      '{"type":"position_changed","position":1}',
    );
    final next = reducer.apply(_empty(), evt);
    expect(next.wait, isNull);
  });

  test('tenant:updated emits a brand patch without touching wait', () {
    final snap = GuestStreamEvent.fromJson(
      '{"type":"snapshot","status":"waiting","position":3,"name":"Alice",'
      '"joinedAt":"2026-04-19T12:00:00.000Z"}',
    );
    final after = reducer.apply(_empty(), snap);
    final evt = GuestStreamEvent.fromJson(
      '{"type":"tenant:updated","name":"Renamed","accentColor":"#FF0000"}',
    );
    final next = reducer.apply(after, evt);
    expect(next.wait!.position, 3);
    expect(next.brandPatch!.name, 'Renamed');
    expect(next.brandPatch!.accentColor, '#FF0000');
  });

  test('tenant:opened and tenant:closed toggle isOpen patch', () {
    final opened = reducer.apply(
      _empty(),
      GuestStreamEvent.fromJson('{"type":"tenant:opened"}'),
    );
    expect(opened.brandPatch!.isOpen, isTrue);
    final closed = reducer.apply(
      _empty(),
      GuestStreamEvent.fromJson('{"type":"tenant:closed"}'),
    );
    expect(closed.brandPatch!.isOpen, isFalse);
  });

  test('unknown event type returns prev state unchanged', () {
    final snap = GuestStreamEvent.fromJson(
      '{"type":"snapshot","status":"waiting","position":3,"name":"Alice",'
      '"joinedAt":"2026-04-19T12:00:00.000Z"}',
    );
    final after = reducer.apply(_empty(), snap);
    final evt = GuestStreamEvent.fromJson('{"type":"not-a-thing"}');
    final next = reducer.apply(after, evt);
    expect(next.wait!.position, 3);
  });
}
