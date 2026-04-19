import 'package:flutter_test/flutter_test.dart';
import 'package:pila/api/models.dart';

void main() {
  group('PartyStatus', () {
    test('parses all known wire values', () {
      expect(PartyStatus.parse('waiting'), PartyStatus.waiting);
      expect(PartyStatus.parse('seated'), PartyStatus.seated);
      expect(PartyStatus.parse('no_show'), PartyStatus.noShow);
      expect(PartyStatus.parse('left'), PartyStatus.left);
      expect(PartyStatus.parse('cancelled'), PartyStatus.cancelled);
    });

    test('isTerminal flips for non-waiting states', () {
      expect(PartyStatus.waiting.isTerminal, isFalse);
      expect(PartyStatus.seated.isTerminal, isTrue);
      expect(PartyStatus.left.isTerminal, isTrue);
      expect(PartyStatus.noShow.isTerminal, isTrue);
      expect(PartyStatus.cancelled.isTerminal, isTrue);
    });

    test('wire round-trip preserves identity', () {
      for (final s in PartyStatus.values) {
        expect(PartyStatus.parse(s.wire), s);
      }
    });

    test('parse throws on unknown input', () {
      expect(() => PartyStatus.parse('weird'), throwsArgumentError);
    });
  });

  group('GuestInfoResponse.fromJson', () {
    test('maps the full info payload including token status', () {
      final info = GuestInfoResponse.fromJson('demo', <String, dynamic>{
        'name': 'Demo Diner',
        'logoUrl': null,
        'accentColor': '#1F6FEB',
        'isOpen': true,
        'tokenStatus': 'ok',
      });
      expect(info.brand.slug, 'demo');
      expect(info.brand.name, 'Demo Diner');
      expect(info.brand.logoUrl, isNull);
      expect(info.brand.accentColor, '#1F6FEB');
      expect(info.brand.isOpen, isTrue);
      expect(info.tokenStatus, TokenStatus.ok);
    });

    test('surfaces expired and missing token states', () {
      final expired = GuestInfoResponse.fromJson('demo', <String, dynamic>{
        'name': 'Demo',
        'logoUrl': null,
        'accentColor': '#000000',
        'isOpen': true,
        'tokenStatus': 'expired',
      });
      expect(expired.tokenStatus, TokenStatus.expired);

      final missing = GuestInfoResponse.fromJson('demo', <String, dynamic>{
        'name': 'Demo',
        'logoUrl': null,
        'accentColor': '#000000',
        'isOpen': false,
        'tokenStatus': 'missing',
      });
      expect(missing.tokenStatus, TokenStatus.missing);
      expect(missing.brand.isOpen, isFalse);
    });
  });

  group('JoinInput.toJson', () {
    test('serializes required fields and null phone', () {
      final json = const JoinInput(name: 'Alice', partySize: 2).toJson();
      expect(json['name'], 'Alice');
      expect(json['partySize'], 2);
      expect(json.containsKey('phone'), isTrue);
      expect(json['phone'], isNull);
    });

    test('preserves phone when provided', () {
      final json = const JoinInput(
        name: 'Bob',
        partySize: 4,
        phone: '+15550001',
      ).toJson();
      expect(json['phone'], '+15550001');
    });
  });

  group('GuestBearerResponse.fromJson', () {
    test('parses token + expires + slug + partyId', () {
      final r = GuestBearerResponse.fromJson(<String, dynamic>{
        'token': 'jwt.abc.def',
        'tokenType': 'Bearer',
        'expiresIn': 86400,
        'slug': 'demo',
        'partyId': '11111111-1111-1111-1111-111111111111',
      });
      expect(r.token, 'jwt.abc.def');
      expect(r.expiresIn, 86400);
      expect(r.slug, 'demo');
      expect(r.partyId.length, 36);
    });
  });
}
