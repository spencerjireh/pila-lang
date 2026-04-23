import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../persistence/party_store.dart';
import '../state/guest_providers.dart';
import '../state/host_providers.dart';
import '../theme/palette.dart';
import '../widgets/brand_scaffold.dart';

/// Cold-launch landing screen. Surfaces up to three role-specific
/// entry points, ordered by urgency:
///   1. Return to your wait (if a local non-terminal party exists)
///   2. Scan QR (always)
///   3. Sign back in to <tenant> (if a host snapshot exists)
///
/// Kiosk-paired devices never see this screen — `main._kioskInitialLocation`
/// short-circuits straight to `/display/<slug>` before the app mounts.
/// See User-Stories § M1, § M2, § M3.
class LandingScreen extends ConsumerStatefulWidget {
  const LandingScreen({super.key});

  @override
  ConsumerState<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends ConsumerState<LandingScreen> {
  GuestPartyRecord? _waiting;
  String? _hostTenantName;
  String? _hostSlug;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final partyStore = ref.read(partyStoreProvider);
    final hostSnapshotStore = ref.read(hostSnapshotStoreProvider);
    final waiting = await partyStore.latestWaiting();
    final hostSlug = await hostSnapshotStore.latestSlug();
    String? hostTenantName;
    if (hostSlug != null) {
      final stored = await hostSnapshotStore.load(hostSlug);
      hostTenantName = stored?.snapshot.tenant.name;
    }
    if (!mounted) return;
    setState(() {
      // Legacy rows predating the v4 schema migration are dropped on open,
      // so a non-null record always carries tenantName. Belt and braces:
      // hide the row if tenantName is blank.
      _waiting = (waiting != null && waiting.tenantName.isNotEmpty)
          ? waiting
          : null;
      _hostSlug = hostSlug;
      _hostTenantName = hostTenantName;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const BrandScaffold(
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final theme = Theme.of(context);
    return BrandScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(
            Icons.restaurant_menu,
            size: 56,
            color: PilaPalette.defaultAccent,
          ),
          const SizedBox(height: 16),
          Text(
            'Pila',
            textAlign: TextAlign.center,
            style: theme.textTheme.headlineMedium?.copyWith(
              color: PilaPalette.foreground,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 48),
          if (_waiting != null) ...[
            FilledButton(
              key: const Key('landing.resumeWait'),
              onPressed: () => context.go(
                '/r/${_waiting!.slug}/wait/${_waiting!.partyId}',
              ),
              style: FilledButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: Text('Return to ${_waiting!.tenantName}'),
            ),
            const SizedBox(height: 12),
          ],
          OutlinedButton.icon(
            key: const Key('landing.scan'),
            onPressed: () => context.go('/scan'),
            icon: const Icon(Icons.qr_code_scanner),
            label: const Text('Scan QR'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
          ),
          if (_hostSlug != null && _hostTenantName != null) ...[
            const SizedBox(height: 12),
            TextButton(
              key: const Key('landing.hostResume'),
              onPressed: () => context.go('/host/$_hostSlug'),
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
              ),
              child: Text('Sign back in to $_hostTenantName'),
            ),
          ],
        ],
      ),
    );
  }
}
