import 'package:sqflite/sqflite.dart';

import '../api/host_models.dart';
import 'database.dart';

class StoredHostSnapshot {
  const StoredHostSnapshot({required this.snapshot, required this.updatedAt});

  final HostSnapshot snapshot;
  final DateTime updatedAt;
}

abstract class HostSnapshotStore {
  Future<void> save(String slug, HostSnapshot snapshot, {DateTime? updatedAt});
  Future<StoredHostSnapshot?> load(String slug);

  /// Slug of the most recently saved snapshot, or null if none exist.
  /// Drives the landing-screen "Sign back in to <tenant>" affordance —
  /// see User-Stories § M2.
  Future<String?> latestSlug();

  Future<void> delete(String slug);
  Future<void> clear();
}

class InMemoryHostSnapshotStore implements HostSnapshotStore {
  final Map<String, StoredHostSnapshot> _rows = <String, StoredHostSnapshot>{};

  @override
  Future<void> save(
    String slug,
    HostSnapshot snapshot, {
    DateTime? updatedAt,
  }) async {
    _rows[slug] = StoredHostSnapshot(
      snapshot: snapshot,
      updatedAt: updatedAt ?? DateTime.now(),
    );
  }

  @override
  Future<StoredHostSnapshot?> load(String slug) async => _rows[slug];

  @override
  Future<String?> latestSlug() async {
    if (_rows.isEmpty) return null;
    final sorted = _rows.entries.toList()
      ..sort((a, b) => b.value.updatedAt.compareTo(a.value.updatedAt));
    return sorted.first.key;
  }

  @override
  Future<void> delete(String slug) async {
    _rows.remove(slug);
  }

  @override
  Future<void> clear() async {
    _rows.clear();
  }
}

class SqfliteHostSnapshotStore implements HostSnapshotStore {
  SqfliteHostSnapshotStore._(this._db);

  final Database _db;

  factory SqfliteHostSnapshotStore.fromDatabase(MobileDatabase database) =>
      SqfliteHostSnapshotStore._(database.db);

  static Future<SqfliteHostSnapshotStore> open() async {
    final database = await MobileDatabase.open();
    return SqfliteHostSnapshotStore._(database.db);
  }

  @override
  Future<void> save(
    String slug,
    HostSnapshot snapshot, {
    DateTime? updatedAt,
  }) async {
    await _db.insert(
      'host_snapshots',
      <String, Object?>{
        'slug': slug,
        'snapshot_json': snapshot.encode(),
        'updated_at': (updatedAt ?? DateTime.now()).millisecondsSinceEpoch,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  @override
  Future<StoredHostSnapshot?> load(String slug) async {
    final rows = await _db.query(
      'host_snapshots',
      where: 'slug = ?',
      whereArgs: <Object>[slug],
      limit: 1,
    );
    if (rows.isEmpty) return null;
    final row = rows.first;
    return StoredHostSnapshot(
      snapshot: HostSnapshot.decode(row['snapshot_json']! as String),
      updatedAt:
          DateTime.fromMillisecondsSinceEpoch(row['updated_at']! as int),
    );
  }

  @override
  Future<String?> latestSlug() async {
    final rows = await _db.query(
      'host_snapshots',
      columns: <String>['slug'],
      orderBy: 'updated_at DESC',
      limit: 1,
    );
    if (rows.isEmpty) return null;
    return rows.first['slug'] as String?;
  }

  @override
  Future<void> delete(String slug) async {
    await _db.delete(
      'host_snapshots',
      where: 'slug = ?',
      whereArgs: <Object>[slug],
    );
  }

  @override
  Future<void> clear() async {
    await _db.delete('host_snapshots');
  }
}

/// Default staleness threshold. Past this the UI shows a stale indicator
/// and action buttons are disabled until the SSE stream reopens.
const Duration kHostSnapshotStaleAfter = Duration(minutes: 2);

bool isHostSnapshotStale(DateTime updatedAt, {DateTime? now}) {
  final reference = now ?? DateTime.now();
  return reference.difference(updatedAt) > kHostSnapshotStaleAfter;
}
