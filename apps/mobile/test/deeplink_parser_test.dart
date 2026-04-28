import 'package:flutter_test/flutter_test.dart';
import 'package:pila/deeplink/parser.dart';

void main() {
  const parser = DeepLinkParser();

  test('parses guest join with token', () {
    final link = parser.parse('https://pila.test/r/demo?t=abc.def.ghi');
    expect(link, isA<GuestJoinLink>());
    final typed = link as GuestJoinLink;
    expect(typed.slug, 'demo');
    expect(typed.token, 'abc.def.ghi');
  });

  test('rejects guest join without token', () {
    final link = parser.parse('https://pila.test/r/demo');
    expect(link, isA<UnknownLink>());
  });

  test('parses guest wait route', () {
    final link = parser.parse('https://pila.test/r/demo/wait/11111111-2222-3333-4444-555555555555');
    expect(link, isA<GuestWaitLink>());
    final typed = link as GuestWaitLink;
    expect(typed.slug, 'demo');
    expect(typed.partyId, '11111111-2222-3333-4444-555555555555');
  });

  test('parses host link', () {
    final link = parser.parse('https://pila.test/host/demo');
    expect(link, isA<HostLink>());
    expect((link as HostLink).slug, 'demo');
  });

  test('parses display link', () {
    final link = parser.parse('https://pila.test/display/demo');
    expect(link, isA<DisplayLink>());
    expect((link as DisplayLink).slug, 'demo');
  });

  test('parses display with trailing path as the slug-only match', () {
    final link = parser.parse('https://pila.test/display/demo/kiosk');
    expect(link, isA<DisplayLink>());
    expect((link as DisplayLink).slug, 'demo');
  });

  test('unknown paths fall through', () {
    expect(parser.parse('https://pila.test/'), isA<UnknownLink>());
    expect(parser.parse('https://pila.test/about'), isA<UnknownLink>());
    expect(parser.parse('https://pila.test/r/'), isA<UnknownLink>());
    expect(parser.parse('not a url'), isA<UnknownLink>());
  });

  test('ignores extra query params that are not `t`', () {
    final link = parser.parse('https://pila.test/r/demo?t=abc&utm_source=qr');
    expect(link, isA<GuestJoinLink>());
    expect((link as GuestJoinLink).token, 'abc');
  });

  group('custom URL scheme (pilalang://)', () {
    test('guest join: host carries the route prefix', () {
      final link = parser.parse('pilalang://r/demo?t=abc.def.ghi');
      expect(link, isA<GuestJoinLink>());
      final typed = link as GuestJoinLink;
      expect(typed.slug, 'demo');
      expect(typed.token, 'abc.def.ghi');
    });

    test('guest wait: host + path segments compose the route', () {
      final link = parser.parse(
        'pilalang://r/demo/wait/11111111-2222-3333-4444-555555555555',
      );
      expect(link, isA<GuestWaitLink>());
      final typed = link as GuestWaitLink;
      expect(typed.slug, 'demo');
      expect(typed.partyId, '11111111-2222-3333-4444-555555555555');
    });

    test('host link', () {
      final link = parser.parse('pilalang://host/demo');
      expect(link, isA<HostLink>());
      expect((link as HostLink).slug, 'demo');
    });

    test('display link', () {
      final link = parser.parse('pilalang://display/demo');
      expect(link, isA<DisplayLink>());
      expect((link as DisplayLink).slug, 'demo');
    });

    test('three-slash form (empty host) still routes via pathSegments', () {
      final link = parser.parse('pilalang:///r/demo?t=xyz');
      expect(link, isA<GuestJoinLink>());
      expect((link as GuestJoinLink).slug, 'demo');
    });

    test('unknown host falls through', () {
      expect(parser.parse('pilalang://about'), isA<UnknownLink>());
    });
  });
}
