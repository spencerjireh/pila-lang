import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:pila/api/host_models.dart';
import 'package:pila/api/models.dart';
import 'package:pila/persistence/host_snapshot_store.dart';
import 'package:pila/persistence/party_store.dart';
import 'package:pila/screens/entry/landing_screen.dart';
import 'package:pila/state/guest_providers.dart';
import 'package:pila/state/host_providers.dart';

HostSnapshot _snapshot({String slug = 'demo', String name = 'Demo Diner'}) {
  return HostSnapshot(
    tenant: HostTenantBrand(
      slug: slug,
      name: name,
      logoUrl: null,
      accentColor: '#1F6FEB',
      isOpen: true,
      timezone: 'UTC',
    ),
    waiting: const <HostWaitingRow>[],
    recentlyResolved: const <HostRecentlyResolvedRow>[],
  );
}

GuestPartyRecord _partyRecord({
  String slug = 'garden',
  String partyId = 'p-1',
  String tenantName = 'Garden Table',
  PartyStatus status = PartyStatus.waiting,
}) {
  return GuestPartyRecord(
    slug: slug,
    partyId: partyId,
    tenantName: tenantName,
    name: 'Alice',
    partySize: 2,
    joinedAt: DateTime.utc(2026, 4, 22, 18),
    status: status,
    updatedAt: DateTime.utc(2026, 4, 22, 18),
  );
}

class _RecordingRouter extends StatefulWidget {
  const _RecordingRouter({required this.child, required this.onRoute});

  final Widget child;
  final ValueChanged<String> onRoute;

  @override
  State<_RecordingRouter> createState() => _RecordingRouterState();
}

class _RecordingRouterState extends State<_RecordingRouter> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = GoRouter(
      initialLocation: '/',
      routes: <RouteBase>[
        GoRoute(path: '/', builder: (_, __) => widget.child),
        GoRoute(
          path: '/scan',
          builder: (_, __) => const _Sink(label: 'scan'),
        ),
        GoRoute(
          path: '/r/:slug/wait/:partyId',
          builder: (ctx, st) => _Sink(
            label: 'wait:${st.pathParameters['slug']}/${st.pathParameters['partyId']}',
          ),
        ),
        GoRoute(
          path: '/host/:slug',
          builder: (ctx, st) => _Sink(label: 'host:${st.pathParameters['slug']}'),
        ),
      ],
      redirect: (ctx, st) {
        if (st.uri.path != '/') widget.onRoute(st.uri.toString());
        return null;
      },
    );
  }

  @override
  void dispose() {
    _router.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(routerConfig: _router);
  }
}

class _Sink extends StatelessWidget {
  const _Sink({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) => Scaffold(body: Text(label));
}

Future<String?> _pumpLanding(
  WidgetTester tester, {
  required PartyStore partyStore,
  required HostSnapshotStore hostSnapshotStore,
}) async {
  String? routed;
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        partyStoreProvider.overrideWithValue(partyStore),
        hostSnapshotStoreProvider.overrideWithValue(hostSnapshotStore),
      ],
      child: _RecordingRouter(
        onRoute: (loc) => routed = loc,
        child: const LandingScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return routed;
}

void main() {
  testWidgets('empty state shows only the Scan button', (tester) async {
    await _pumpLanding(
      tester,
      partyStore: InMemoryPartyStore(),
      hostSnapshotStore: InMemoryHostSnapshotStore(),
    );

    expect(find.byKey(const Key('landing.scan')), findsOneWidget);
    expect(find.byKey(const Key('landing.resumeWait')), findsNothing);
    expect(find.byKey(const Key('landing.hostResume')), findsNothing);
  });

  testWidgets('host snapshot surfaces the Sign-back-in row', (tester) async {
    final hostStore = InMemoryHostSnapshotStore();
    await hostStore.save('demo', _snapshot(name: 'Demo Diner'));

    await _pumpLanding(
      tester,
      partyStore: InMemoryPartyStore(),
      hostSnapshotStore: hostStore,
    );

    expect(find.text('Sign back in to Demo Diner'), findsOneWidget);
    expect(find.byKey(const Key('landing.resumeWait')), findsNothing);
  });

  testWidgets('waiting party surfaces the Return-to-wait row', (tester) async {
    final partyStore = InMemoryPartyStore();
    await partyStore.upsert(_partyRecord(tenantName: 'Garden Table'));

    await _pumpLanding(
      tester,
      partyStore: partyStore,
      hostSnapshotStore: InMemoryHostSnapshotStore(),
    );

    expect(find.text('Return to Garden Table'), findsOneWidget);
    expect(find.byKey(const Key('landing.hostResume')), findsNothing);
  });

  testWidgets('both rows appear when both stores have data', (tester) async {
    final partyStore = InMemoryPartyStore();
    await partyStore.upsert(_partyRecord(tenantName: 'Garden Table'));
    final hostStore = InMemoryHostSnapshotStore();
    await hostStore.save('demo', _snapshot(name: 'Demo Diner'));

    await _pumpLanding(
      tester,
      partyStore: partyStore,
      hostSnapshotStore: hostStore,
    );

    expect(find.byKey(const Key('landing.resumeWait')), findsOneWidget);
    expect(find.byKey(const Key('landing.scan')), findsOneWidget);
    expect(find.byKey(const Key('landing.hostResume')), findsOneWidget);
  });

  testWidgets('terminal-only party store hides the wait row', (tester) async {
    final partyStore = InMemoryPartyStore();
    await partyStore.upsert(_partyRecord(status: PartyStatus.seated));

    await _pumpLanding(
      tester,
      partyStore: partyStore,
      hostSnapshotStore: InMemoryHostSnapshotStore(),
    );

    expect(find.byKey(const Key('landing.resumeWait')), findsNothing);
  });

  testWidgets('row with blank tenantName is hidden', (tester) async {
    final partyStore = InMemoryPartyStore();
    await partyStore.upsert(_partyRecord(tenantName: ''));

    await _pumpLanding(
      tester,
      partyStore: partyStore,
      hostSnapshotStore: InMemoryHostSnapshotStore(),
    );

    expect(find.byKey(const Key('landing.resumeWait')), findsNothing);
  });

  testWidgets('blank host tenant name hides the sign-back-in row',
      (tester) async {
    final hostStore = InMemoryHostSnapshotStore();
    await hostStore.save('demo', _snapshot(name: '   '));

    await _pumpLanding(
      tester,
      partyStore: InMemoryPartyStore(),
      hostSnapshotStore: hostStore,
    );

    expect(find.byKey(const Key('landing.hostResume')), findsNothing);
    expect(find.byKey(const Key('landing.scan')), findsOneWidget);
  });

  testWidgets('store throw does not strand the spinner', (tester) async {
    // Swallow the intentional error so the test runner doesn't mark it
    // as a failure — FlutterError.reportError is what our bootstrap uses.
    final originalOnError = FlutterError.onError;
    FlutterError.onError = (_) {};
    addTearDown(() => FlutterError.onError = originalOnError);

    await _pumpLanding(
      tester,
      partyStore: _ThrowingPartyStore(),
      hostSnapshotStore: InMemoryHostSnapshotStore(),
    );

    expect(find.byKey(const Key('landing.scan')), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.byKey(const Key('landing.resumeWait')), findsNothing);
    expect(find.byKey(const Key('landing.hostResume')), findsNothing);
  });

  testWidgets('tap Scan routes to /scan', (tester) async {
    String? routed;
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          partyStoreProvider.overrideWithValue(InMemoryPartyStore()),
          hostSnapshotStoreProvider
              .overrideWithValue(InMemoryHostSnapshotStore()),
        ],
        child: _RecordingRouter(
          onRoute: (loc) => routed = loc,
          child: const LandingScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('landing.scan')));
    await tester.pumpAndSettle();
    expect(routed, '/scan');
  });

  testWidgets('tap Return-to-wait routes to the wait URL', (tester) async {
    final partyStore = InMemoryPartyStore();
    await partyStore.upsert(
      _partyRecord(slug: 'garden', partyId: 'xyz', tenantName: 'Garden Table'),
    );

    String? routed;
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          partyStoreProvider.overrideWithValue(partyStore),
          hostSnapshotStoreProvider
              .overrideWithValue(InMemoryHostSnapshotStore()),
        ],
        child: _RecordingRouter(
          onRoute: (loc) => routed = loc,
          child: const LandingScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('landing.resumeWait')));
    await tester.pumpAndSettle();
    expect(routed, '/r/garden/wait/xyz');
  });

  testWidgets('tap Sign-back-in routes to /host/<slug>', (tester) async {
    final hostStore = InMemoryHostSnapshotStore();
    await hostStore.save('demo', _snapshot());

    String? routed;
    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          partyStoreProvider.overrideWithValue(InMemoryPartyStore()),
          hostSnapshotStoreProvider.overrideWithValue(hostStore),
        ],
        child: _RecordingRouter(
          onRoute: (loc) => routed = loc,
          child: const LandingScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('landing.hostResume')));
    await tester.pumpAndSettle();
    expect(routed, '/host/demo');
  });
}

class _ThrowingPartyStore implements PartyStore {
  @override
  Future<void> upsert(GuestPartyRecord record) async {}
  @override
  Future<GuestPartyRecord?> findByParty(String slug, String partyId) async =>
      null;
  @override
  Future<GuestPartyRecord?> latestForSlug(String slug) async => null;
  @override
  Future<GuestPartyRecord?> latestWaiting() async =>
      throw StateError('simulated sqflite failure');
  @override
  Future<void> delete(String slug, String partyId) async {}
  @override
  Future<void> clear() async {}
}
