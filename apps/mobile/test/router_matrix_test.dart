import 'package:flutter_test/flutter_test.dart';
import 'package:pila/deeplink/parser.dart';
import 'package:pila/deeplink/router.dart';

void main() {
  const parser = DeepLinkParser();

  test('guest join with token maps to /r/<slug>?t=<token>', () {
    final link = parser.parse('https://pila.test/r/demo?t=abc.def.ghi');
    expect(deepLinkToLocation(link), '/r/demo?t=abc.def.ghi');
  });

  test('guest join token is url-encoded', () {
    final link = parser.parse('https://pila.test/r/demo?t=has%2Bplus');
    expect(deepLinkToLocation(link), contains('t='));
    expect(deepLinkToLocation(link), contains('demo'));
  });

  test('guest wait maps to /r/<slug>/wait/<partyId>', () {
    final link = parser.parse(
      'https://pila.test/r/demo/wait/11111111-2222-3333-4444-555555555555',
    );
    expect(
      deepLinkToLocation(link),
      '/r/demo/wait/11111111-2222-3333-4444-555555555555',
    );
  });

  test('host maps to /host/<slug>', () {
    final link = parser.parse('https://pila.test/host/demo');
    expect(deepLinkToLocation(link), '/host/demo');
  });

  test('display maps to /display/<slug>', () {
    final link = parser.parse('https://pila.test/display/demo');
    expect(deepLinkToLocation(link), '/display/demo');
  });

  test('unknown link returns null (fall-through to splash)', () {
    final link = parser.parse('https://pila.test/');
    expect(deepLinkToLocation(link), isNull);
  });

  test('garbage URL returns null', () {
    final link = parser.parse('not a url');
    expect(deepLinkToLocation(link), isNull);
  });

  test('guest join without token returns null (unroutable)', () {
    final link = parser.parse('https://pila.test/r/demo');
    expect(deepLinkToLocation(link), isNull);
  });
}
