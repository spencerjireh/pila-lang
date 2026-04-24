import 'package:sqflite/sqflite.dart';

import 'database.dart';

/// Single-row store that remembers which tenant a kiosk device is paired
/// with. Used by `main.dart` to resolve the cold-launch initial location
/// and by the display screen's long-press gesture to re-enter pairing.
abstract class DisplayPairingStore {
  Future<String?> currentSlug();
  Future<void> pair(String slug);
  Future<void> clear();
}

class InMemoryDisplayPairingStore implements DisplayPairingStore {
  String? _slug;

  @override
  Future<String?> currentSlug() async => _slug;

  @override
  Future<void> pair(String slug) async {
    _slug = slug;
  }

  @override
  Future<void> clear() async {
    _slug = null;
  }
}

class SqfliteDisplayPairingStore implements DisplayPairingStore {
  SqfliteDisplayPairingStore._(this._db);

  final Database _db;

  factory SqfliteDisplayPairingStore.fromDatabase(MobileDatabase database) =>
      SqfliteDisplayPairingStore._(database.db);

  static Future<SqfliteDisplayPairingStore> open() async {
    final database = await MobileDatabase.open();
    return SqfliteDisplayPairingStore._(database.db);
  }

  @override
  Future<String?> currentSlug() async {
    final rows = await _db.query(
      'kiosk_pairing',
      where: 'id = 1',
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['slug'] as String?;
  }

  @override
  Future<void> pair(String slug) async {
    await _db.insert(
      'kiosk_pairing',
      <String, Object?>{
        'id': 1,
        'slug': slug,
        'paired_at': DateTime.now().millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  @override
  Future<void> clear() async {
    await _db.delete('kiosk_pairing', where: 'id = 1');
  }
}
