import 'package:flutter_test/flutter_test.dart';
import 'package:pila/persistence/display_pairing_store.dart';

void main() {
  group('InMemoryDisplayPairingStore', () {
    test('round-trips a slug through pair/currentSlug', () async {
      final store = InMemoryDisplayPairingStore();
      expect(await store.currentSlug(), isNull);
      await store.pair('demo');
      expect(await store.currentSlug(), 'demo');
    });

    test('pair replaces the existing slug', () async {
      final store = InMemoryDisplayPairingStore();
      await store.pair('demo');
      await store.pair('another');
      expect(await store.currentSlug(), 'another');
    });

    test('clear removes the pairing', () async {
      final store = InMemoryDisplayPairingStore();
      await store.pair('demo');
      await store.clear();
      expect(await store.currentSlug(), isNull);
    });
  });
}
