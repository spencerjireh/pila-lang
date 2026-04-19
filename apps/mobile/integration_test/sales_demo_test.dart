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

/// End-to-end sales demo: a guest joins via a deep-link token, the host
/// exchanges a bearer and seats them, the wait screen transitions to the
/// terminal "your table is ready" frame. Requires the Next.js dev stack at
/// `PILA_API_BASE_URL` (default `http://localhost:3000`) in `NODE_ENV=test`.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('guest joins + host seats + terminal screen renders',
      (tester) async {
    final client = PilaTestClient();
    const slug = 'integration-sales';
    await client.resetTenant(slug);
    final tenant = await client.setupTenant(slug: slug);
    await client.flushRedis();
    final token = await client.mintQrToken(slug);
    final joinUrl = '/r/$slug?t=$token';

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
        child: PilaApp(initialLocation: joinUrl),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField).first, 'Integration Guest');
    await tester.pumpAndSettle();

    final joinButton = find.widgetWithText(FilledButton, 'Join the queue');
    if (joinButton.evaluate().isNotEmpty) {
      await tester.tap(joinButton);
      await tester.pumpAndSettle(const Duration(seconds: 5));
    }

    final bearer = await client.exchangeHostToken(
      slug: slug,
      password: tenant.password,
    );
    final waiting =
        await client.listWaitingParties(slug: slug, bearer: bearer);
    expect(waiting, isNotEmpty,
        reason: 'guest join must materialize in the host snapshot',);
    final partyId = waiting.first['id'] as String;
    await client.seatParty(slug: slug, partyId: partyId, bearer: bearer);

    for (var i = 0; i < 20; i++) {
      await tester.pump(const Duration(milliseconds: 250));
      if (find.textContaining('table is ready').evaluate().isNotEmpty) break;
    }
    expect(
      find.textContaining('table is ready'),
      findsOneWidget,
      reason: 'seat event must transition the wait screen within 5s',
    );

    client.close();
  });
}
