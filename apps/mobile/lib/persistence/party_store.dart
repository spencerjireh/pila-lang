import 'package:sqflite/sqflite.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

import '../api/models.dart';

/// A persistent record of the guest's most recent party interaction per
/// (slug, partyId). Cold-launch reads this to decide whether to render the
/// terminal screen directly or reconnect the SSE stream.
class GuestPartyRecord {
  const GuestPartyRecord({
    required this.slug,
    required this.partyId,
    required this.tenantName,
    required this.name,
    required this.partySize,
    required this.joinedAt,
    required this.status,
    required this.updatedAt,
    this.resolvedAt,
  });

  final String slug;
  final String partyId;
  final String tenantName;
  final String name;
  final int partySize;
  final DateTime joinedAt;
  final PartyStatus status;
  final DateTime? resolvedAt;
  final DateTime updatedAt;

  GuestPartyRecord copyWith({
    String? tenantName,
    PartyStatus? status,
    DateTime? resolvedAt,
    DateTime? updatedAt,
  }) {
    return GuestPartyRecord(
      slug: slug,
      partyId: partyId,
      tenantName: tenantName ?? this.tenantName,
      name: name,
      partySize: partySize,
      joinedAt: joinedAt,
      status: status ?? this.status,
      resolvedAt: resolvedAt ?? this.resolvedAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toRow() => <String, dynamic>{
        'slug': slug,
        'party_id': partyId,
        'tenant_name': tenantName,
        'name': name,
        'party_size': partySize,
        'joined_at': joinedAt.millisecondsSinceEpoch,
        'status': status.wire,
        'resolved_at': resolvedAt?.millisecondsSinceEpoch,
        'updated_at': updatedAt.millisecondsSinceEpoch,
      };

  static GuestPartyRecord fromRow(Map<String, Object?> row) {
    return GuestPartyRecord(
      slug: row['slug']! as String,
      partyId: row['party_id']! as String,
      tenantName: row['tenant_name']! as String,
      name: row['name']! as String,
      partySize: (row['party_size']! as int),
      joinedAt:
          DateTime.fromMillisecondsSinceEpoch(row['joined_at']! as int),
      status: PartyStatus.parse(row['status']! as String),
      resolvedAt: row['resolved_at'] == null
          ? null
          : DateTime.fromMillisecondsSinceEpoch(row['resolved_at']! as int),
      updatedAt:
          DateTime.fromMillisecondsSinceEpoch(row['updated_at']! as int),
    );
  }
}

abstract class PartyStore {
  Future<void> upsert(GuestPartyRecord record);
  Future<GuestPartyRecord?> findByParty(String slug, String partyId);
  Future<GuestPartyRecord?> latestForSlug(String slug);

  /// Most recently updated record across all slugs whose status is still
  /// [PartyStatus.waiting]. Drives the landing-screen "Return to your wait"
  /// row — see User-Stories § M3.
  Future<GuestPartyRecord?> latestWaiting();

  Future<void> delete(String slug, String partyId);
  Future<void> clear();
}

class InMemoryPartyStore implements PartyStore {
  final Map<String, GuestPartyRecord> _rows = <String, GuestPartyRecord>{};

  String _key(String slug, String partyId) => '$slug::$partyId';

  @override
  Future<void> upsert(GuestPartyRecord record) async {
    _rows[_key(record.slug, record.partyId)] = record;
  }

  @override
  Future<GuestPartyRecord?> findByParty(String slug, String partyId) async {
    return _rows[_key(slug, partyId)];
  }

  @override
  Future<GuestPartyRecord?> latestForSlug(String slug) async {
    final matches = _rows.values.where((r) => r.slug == slug).toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return matches.isEmpty ? null : matches.first;
  }

  @override
  Future<GuestPartyRecord?> latestWaiting() async {
    final matches = _rows.values
        .where((r) => r.status == PartyStatus.waiting)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    return matches.isEmpty ? null : matches.first;
  }

  @override
  Future<void> delete(String slug, String partyId) async {
    _rows.remove(_key(slug, partyId));
  }

  @override
  Future<void> clear() async {
    _rows.clear();
  }
}

/// Shared sqflite database for all mobile persistence. Each store opens
/// the same file and operates on its own table.
class MobileDatabase {
  MobileDatabase._(this.db);

  final Database db;

  static const int schemaVersion = 4;

  static Future<MobileDatabase> open() async {
    final dir = await getApplicationDocumentsDirectory();
    final path = p.join(dir.path, 'pila_mobile.db');
    final database = await openDatabase(
      path,
      version: schemaVersion,
      onCreate: (db, version) async {
        await _createGuestTable(db);
        await _createHostTable(db);
        await _createKioskTable(db);
      },
      onUpgrade: (db, oldVersion, newVersion) async {
        if (oldVersion < 2) {
          await _createHostTable(db);
        }
        if (oldVersion < 3) {
          await _createKioskTable(db);
        }
        if (oldVersion < 4) {
          // v4 adds the tenant_name column to guest_parties. A drop-and-
          // recreate is acceptable pre-pilot: the server-side party row is
          // untouched, so any mid-queue upgrader just re-enters via the QR.
          await db.execute('DROP TABLE IF EXISTS guest_parties');
          await _createGuestTable(db);
        }
      },
    );
    return MobileDatabase._(database);
  }

  static Future<void> _createGuestTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS guest_parties (
        slug TEXT NOT NULL,
        party_id TEXT NOT NULL,
        tenant_name TEXT NOT NULL,
        name TEXT NOT NULL,
        party_size INTEGER NOT NULL,
        joined_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        resolved_at INTEGER,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (slug, party_id)
      )
    ''');
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_guest_parties_slug_updated '
      'ON guest_parties(slug, updated_at DESC)',
    );
    await db.execute(
      'CREATE INDEX IF NOT EXISTS idx_guest_parties_status_updated '
      'ON guest_parties(status, updated_at DESC)',
    );
  }

  static Future<void> _createHostTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS host_snapshots (
        slug TEXT PRIMARY KEY,
        snapshot_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    ''');
  }

  static Future<void> _createKioskTable(Database db) async {
    await db.execute('''
      CREATE TABLE IF NOT EXISTS kiosk_pairing (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        slug TEXT NOT NULL,
        paired_at INTEGER NOT NULL
      )
    ''');
  }
}

class SqflitePartyStore implements PartyStore {
  SqflitePartyStore._(this._db);

  final Database _db;

  /// Preferred constructor when sharing the database with other stores.
  factory SqflitePartyStore.fromDatabase(MobileDatabase database) =>
      SqflitePartyStore._(database.db);

  /// Convenience entry point for callers that don't need to share the
  /// underlying database handle.
  static Future<SqflitePartyStore> open() async {
    final database = await MobileDatabase.open();
    return SqflitePartyStore._(database.db);
  }

  @override
  Future<void> upsert(GuestPartyRecord record) async {
    await _db.insert(
      'guest_parties',
      record.toRow(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  @override
  Future<GuestPartyRecord?> findByParty(String slug, String partyId) async {
    final rows = await _db.query(
      'guest_parties',
      where: 'slug = ? AND party_id = ?',
      whereArgs: <Object>[slug, partyId],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return GuestPartyRecord.fromRow(rows.first);
  }

  @override
  Future<GuestPartyRecord?> latestForSlug(String slug) async {
    final rows = await _db.query(
      'guest_parties',
      where: 'slug = ?',
      whereArgs: <Object>[slug],
      orderBy: 'updated_at DESC',
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return GuestPartyRecord.fromRow(rows.first);
  }

  @override
  Future<GuestPartyRecord?> latestWaiting() async {
    final rows = await _db.query(
      'guest_parties',
      where: 'status = ?',
      whereArgs: <Object>[PartyStatus.waiting.wire],
      orderBy: 'updated_at DESC',
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return GuestPartyRecord.fromRow(rows.first);
  }

  @override
  Future<void> delete(String slug, String partyId) async {
    await _db.delete(
      'guest_parties',
      where: 'slug = ? AND party_id = ?',
      whereArgs: <Object>[slug, partyId],
    );
  }

  @override
  Future<void> clear() async {
    await _db.delete('guest_parties');
  }
}
