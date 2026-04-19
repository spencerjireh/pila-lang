import 'package:flutter/material.dart';
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

import 'support/test_client.dart';

/// Host login + queue snapshot + seat flow with a pre-seeded waiting
/// party. The assertion is deliberately loose (row appears, seat button
/// removes it) so simulator render cadence doesn't flake.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('host logs in, sees seeded party, seats it', (tester) async {
    final client = PilaTestClient();
    const slug = 'integration-host';
    await client.resetTenant(slug);
    final tenant = await client.setupTenant(
      slug: slug,
      waitingParties: <Map<String, dynamic>>[
        <String, dynamic>{
          'name': 'Priya Patel',
          'partySize': 2,
          'minutesAgo': 4,
        },
      ],
    );
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
        child: const PilaApp(initialLocation: '/host/$slug'),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, tenant.password);
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Sign in'));
    await tester.pumpAndSettle(const Duration(seconds: 5));

    expect(find.text('Priya Patel'), findsOneWidget);

    await tester.tap(find.widgetWithText(FilledButton, 'Seat'));
    await tester.pumpAndSettle(const Duration(seconds: 3));

    expect(find.text('Priya Patel'), findsOneWidget,
        reason: 'row should now appear in recently-resolved',);

    client.close();
  });
}
