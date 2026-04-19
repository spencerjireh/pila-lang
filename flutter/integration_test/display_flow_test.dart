import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:pila/app.dart';
import 'package:pila/auth/bearer_storage.dart';
import 'package:pila/persistence/display_pairing_store.dart';
import 'package:pila/persistence/host_snapshot_store.dart';
import 'package:pila/persistence/party_store.dart';
import 'package:pila/screens/display/display_pairing_screen.dart';
import 'package:pila/state/guest_providers.dart';
import 'package:pila/state/host_providers.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'support/test_client.dart';

/// Display flow: QR renders when the queue is open, closed-banner swaps
/// when the host closes, and reopening restores the QR.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('QR renders when open, closed banner swaps on close',
      (tester) async {
    final client = PilaTestClient();
    const slug = 'integration-display';
    await client.resetTenant(slug);
    final tenant = await client.setupTenant(slug: slug);
    await client.flushRedis();

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          partyStoreProvider.overrideWithValue(InMemoryPartyStore()),
          hostSnapshotStoreProvider
              .overrideWithValue(InMemoryHostSnapshotStore()),
          displayPairingStoreProvider
              .overrideWithValue(InMemoryDisplayPairingStore()),
          bearerStorageProvider.overrideWithValue(InMemoryBearerStorage()),
        ],
        child: const PilaApp(initialLocation: '/display/$slug'),
      ),
    );
    await tester.pumpAndSettle(const Duration(seconds: 3));

    expect(find.byType(QrImageView), findsOneWidget);

    final bearer = await client.exchangeHostToken(
      slug: slug,
      password: tenant.password,
    );
    await client.closeQueue(slug: slug, bearer: bearer);

    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 250));
      if (find.textContaining('Not accepting guests').evaluate().isNotEmpty) {
        break;
      }
    }
    expect(find.textContaining('Not accepting guests'), findsOneWidget);

    await client.openQueue(slug: slug, bearer: bearer);
    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 250));
      if (find.byType(QrImageView).evaluate().isNotEmpty) break;
    }
    expect(find.byType(QrImageView), findsOneWidget);

    client.close();
  });
}
