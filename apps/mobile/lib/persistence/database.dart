import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:sqflite/sqflite.dart';

/// Shared sqflite handle for every pila mobile store. One file; each store
/// operates on its own table. Schema version and migrations live here so a
/// future migration touches a single callsite.
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
      onCreate: (db, _) async {
        await _createGuestPartiesTable(db);
        await _createHostSnapshotsTable(db);
        await _createKioskPairingTable(db);
      },
      onUpgrade: (db, oldVersion, _) async {
        if (oldVersion < 2) await _createHostSnapshotsTable(db);
        if (oldVersion < 3) await _createKioskPairingTable(db);
        if (oldVersion < 4) await _migrateGuestPartiesToV4(db);
      },
    );
    return MobileDatabase._(database);
  }
}

Future<void> _createGuestPartiesTable(Database db) async {
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

Future<void> _createHostSnapshotsTable(Database db) async {
  await db.execute('''
    CREATE TABLE IF NOT EXISTS host_snapshots (
      slug TEXT PRIMARY KEY,
      snapshot_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  ''');
}

Future<void> _createKioskPairingTable(Database db) async {
  await db.execute('''
    CREATE TABLE IF NOT EXISTS kiosk_pairing (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      slug TEXT NOT NULL,
      paired_at INTEGER NOT NULL
    )
  ''');
}

/// v4 adds tenant_name to guest_parties. Drop-and-recreate is acceptable
/// pre-pilot: the server-side party row is untouched, so any mid-queue
/// upgrader just re-enters via the QR.
Future<void> _migrateGuestPartiesToV4(Database db) async {
  await db.execute('DROP TABLE IF EXISTS guest_parties');
  await _createGuestPartiesTable(db);
}
