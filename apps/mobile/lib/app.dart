import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'deeplink/link_bootstrap.dart';
import 'screens/display/display_pairing_screen.dart';
import 'screens/display/display_screen.dart';
import 'screens/host/host_history_screen.dart';
import 'screens/host/host_login_screen.dart';
import 'screens/host/host_queue_screen.dart';
import 'screens/host/host_settings_screen.dart';
import 'screens/join_screen.dart';
import 'screens/landing_screen.dart';
import 'screens/scan_screen.dart';
import 'screens/wait_screen.dart';
import 'state/host_providers.dart';
import 'theme/pila_theme.dart';

class PilaApp extends ConsumerStatefulWidget {
  const PilaApp({super.key, this.initialLocation});

  final String? initialLocation;

  @override
  ConsumerState<PilaApp> createState() => _PilaAppState();
}

class _PilaAppState extends ConsumerState<PilaApp> {
  late final GoRouter _router;
  final LinkBootstrap _links = LinkBootstrap();

  static const Set<String> _hostAuthedSubpaths = <String>{
    'queue',
    'settings',
    'guests',
  };

  @override
  void initState() {
    super.initState();
    final auth = ref.read(hostAuthControllerProvider);
    _router = GoRouter(
      initialLocation: widget.initialLocation ?? '/',
      refreshListenable: auth,
      redirect: (context, state) {
        final loc = state.uri.path;
        final segments = loc.split('/').where((s) => s.isNotEmpty).toList();
        if (segments.isEmpty || segments.first != 'host') return null;
        if (segments.length < 2) return null;
        final slug = segments[1];
        final tail = segments.length >= 3 ? segments[2] : null;
        if (auth.authed) {
          if (tail == null) return '/host/$slug/queue';
        } else {
          if (tail != null && _hostAuthedSubpaths.contains(tail)) {
            return '/host/$slug';
          }
        }
        return null;
      },
      routes: <RouteBase>[
        GoRoute(
          path: '/',
          builder: (_, __) => const LandingScreen(),
        ),
        GoRoute(
          path: '/scan',
          builder: (_, __) => const ScanScreen(),
        ),
        GoRoute(
          path: '/r/:slug',
          builder: (context, state) {
            final slug = state.pathParameters['slug']!;
            final token = state.uri.queryParameters['t'] ?? '';
            return JoinScreen(slug: slug, token: token);
          },
        ),
        GoRoute(
          path: '/r/:slug/wait/:partyId',
          builder: (context, state) {
            final slug = state.pathParameters['slug']!;
            final partyId = state.pathParameters['partyId']!;
            return WaitScreen(slug: slug, partyId: partyId);
          },
        ),
        GoRoute(
          path: '/host/:slug',
          builder: (context, state) =>
              HostLoginScreen(slug: state.pathParameters['slug']!),
        ),
        GoRoute(
          path: '/host/:slug/queue',
          builder: (context, state) =>
              HostQueueScreen(slug: state.pathParameters['slug']!),
        ),
        GoRoute(
          path: '/host/:slug/settings',
          builder: (context, state) =>
              HostSettingsScreen(slug: state.pathParameters['slug']!),
        ),
        GoRoute(
          path: '/host/:slug/guests',
          builder: (context, state) =>
              HostHistoryScreen(slug: state.pathParameters['slug']!),
        ),
        GoRoute(
          path: '/display',
          builder: (_, __) => const DisplayPairingScreen(),
        ),
        GoRoute(
          path: '/display/:slug',
          builder: (context, state) =>
              DisplayScreen(slug: state.pathParameters['slug']!),
        ),
      ],
    );
    _links.attach(_router);
  }

  @override
  void dispose() {
    _links.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Pila Lang',
      debugShowCheckedModeBanner: false,
      theme: buildPilaTheme(),
      routerConfig: _router,
    );
  }
}
