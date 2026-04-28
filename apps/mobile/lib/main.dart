import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:timezone/data/latest.dart' as tzdata;

import 'app.dart';
import 'deeplink/link_bootstrap.dart';
import 'persistence/database.dart';
import 'persistence/display_pairing_store.dart';
import 'persistence/host_snapshot_store.dart';
import 'persistence/party_store.dart';
import 'push/firebase_bootstrap.dart';
import 'push/push_navigator.dart';
import 'screens/display/display_pairing_screen.dart';
import 'state/guest_providers.dart';
import 'state/host_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  tzdata.initializeTimeZones();
  await ensureFirebase();

  final database = await MobileDatabase.open();
  final partyStore = SqflitePartyStore.fromDatabase(database);
  final hostSnapshotStore = SqfliteHostSnapshotStore.fromDatabase(database);
  final pairingStore = SqfliteDisplayPairingStore.fromDatabase(database);
  // Independent cold-start sources — run in parallel so the 2s timeout in
  // PushNavigator (iOS-Sim hang guard) doesn't add to deep-link wait time.
  final results = await Future.wait<String?>(<Future<String?>>[
    LinkBootstrap().initialLocation(),
    PushNavigator().initialLocation(),
  ]);
  final initialLocation = results[0] ??
      results[1] ??
      await _kioskInitialLocation(pairingStore);

  runApp(
    ProviderScope(
      overrides: <Override>[
        partyStoreProvider.overrideWithValue(partyStore),
        hostSnapshotStoreProvider.overrideWithValue(hostSnapshotStore),
        displayPairingStoreProvider.overrideWithValue(pairingStore),
      ],
      child: PilaApp(initialLocation: initialLocation),
    ),
  );
}

Future<String?> _kioskInitialLocation(DisplayPairingStore store) async {
  final slug = await store.currentSlug();
  if (slug == null || slug.isEmpty) return null;
  return '/display/$slug';
}
