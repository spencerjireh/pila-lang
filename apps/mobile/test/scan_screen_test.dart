import 'package:flutter_test/flutter_test.dart';
import 'package:pila/screens/scan_screen.dart';

void main() {
  group('resolveScanLocation', () {
    test('routes a guest-join QR', () {
      final loc = resolveScanLocation(
        'https://pila.test/r/demo?t=abc.def.ghi',
      );
      expect(loc, '/r/demo?t=abc.def.ghi');
    });

    test('routes a guest-wait QR', () {
      final loc = resolveScanLocation(
        'https://pila.test/r/demo/wait/11111111-2222-3333-4444-555555555555',
      );
      expect(loc, '/r/demo/wait/11111111-2222-3333-4444-555555555555');
    });

    test('routes a host QR to /host/<slug>', () {
      final loc = resolveScanLocation('https://pila.test/host/demo');
      expect(loc, '/host/demo');
    });

    test('routes a display QR to /display/<slug>', () {
      final loc = resolveScanLocation('https://pila.test/display/demo');
      expect(loc, '/display/demo');
    });

    test('returns null for a non-Pila URL', () {
      final loc = resolveScanLocation('https://google.com/search?q=tacos');
      expect(loc, isNull);
    });

    test('returns null for garbage input', () {
      final loc = resolveScanLocation('not a url at all');
      expect(loc, isNull);
    });

    test('returns null for /r/<slug> without a token', () {
      final loc = resolveScanLocation('https://pila.test/r/demo');
      expect(loc, isNull);
    });
  });
}
