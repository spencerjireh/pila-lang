import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/models.dart';
import '../persistence/party_store.dart';
import '../state/guest_providers.dart';
import '../theme/palette.dart';
import '../widgets/brand_scaffold.dart';
import '../widgets/reconnect_banner.dart';
import '../widgets/tenant_header.dart';
import 'terminal_screen.dart';

class WaitScreen extends ConsumerStatefulWidget {
  const WaitScreen({super.key, required this.slug, required this.partyId});

  final String slug;
  final String partyId;

  @override
  ConsumerState<WaitScreen> createState() => _WaitScreenState();
}

class _WaitScreenState extends ConsumerState<WaitScreen>
    with WidgetsBindingObserver {
  TenantBrand? _brand;
  GuestPartyRecord? _cached;
  Timer? _ticker;
  Duration _waited = Duration.zero;
  bool _loadedFromCache = false;
  bool _terminalPersisted = false;

  CurrentSession get _session =>
      CurrentSession(slug: widget.slug, partyId: widget.partyId);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      final joined = ref.read(waitControllerProvider(_session)).wait?.joinedAt;
      if (joined == null) return;
      if (!mounted) return;
      setState(() => _waited = DateTime.now().difference(joined));
    });
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final store = ref.read(partyStoreProvider);
    final cached = await store.findByParty(widget.slug, widget.partyId);
    if (!mounted) return;
    _cached = cached;

    if (cached != null && cached.status.isTerminal) {
      final controller = ref.read(waitControllerProvider(_session).notifier);
      await controller.seed(
        WaitState(
          status: cached.status,
          position: 0,
          name: cached.name,
          joinedAt: cached.joinedAt,
          resolvedAt: cached.resolvedAt,
        ),
      );
      setState(() => _loadedFromCache = true);
      return;
    }

    if (cached != null) {
      final controller = ref.read(waitControllerProvider(_session).notifier);
      await controller.seed(
        WaitState(
          status: cached.status,
          position: 0,
          name: cached.name,
          joinedAt: cached.joinedAt,
        ),
      );
    }
    ref.read(waitControllerProvider(_session).notifier).start();
    try {
      final info = await ref.read(guestApiProvider).fetchInfo(widget.slug);
      if (!mounted) return;
      setState(() => _brand = info.brand);
    } catch (_) {
      // Non-fatal — the wait card still shows position + name.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = ref.read(waitControllerProvider(_session).notifier);
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      controller.onBackgrounded();
    } else if (state == AppLifecycleState.resumed) {
      controller.onForegrounded();
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _confirmLeave() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: const Text('Leave the queue?'),
          content: const Text(
            "You'll lose your spot. You can always rejoin by scanning again.",
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('Stay'),
            ),
            FilledButton(
              style:
                  FilledButton.styleFrom(backgroundColor: PilaPalette.danger),
              onPressed: () => Navigator.of(dialogContext).pop(true),
              child: const Text('Leave'),
            ),
          ],
        );
      },
    );
    if (confirmed != true) return;
    try {
      await ref
          .read(guestApiProvider)
          .leave(slug: widget.slug, partyId: widget.partyId);
    } catch (_) {
      // Ignore — SSE will reflect shortly.
    }
  }

  Future<void> _persistTerminalIfNeeded(WaitState wait) async {
    if (_terminalPersisted) return;
    _terminalPersisted = true;
    final store = ref.read(partyStoreProvider);
    final rec = _cached ??
        await store.findByParty(widget.slug, widget.partyId);
    final base = rec ??
        GuestPartyRecord(
          slug: widget.slug,
          partyId: widget.partyId,
          tenantName: _brand?.name ?? '',
          name: wait.name,
          partySize: 0,
          joinedAt: wait.joinedAt,
          status: wait.status,
          updatedAt: DateTime.now(),
          resolvedAt: wait.resolvedAt,
        );
    await store.upsert(
      base.copyWith(
        status: wait.status,
        resolvedAt: wait.resolvedAt ?? DateTime.now(),
        updatedAt: DateTime.now(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(waitControllerProvider(_session));
    final wait = state.wait;
    final brand = _brand;

    if (wait == null) {
      return const BrandScaffold(
        child: Center(child: CircularProgressIndicator()),
      );
    }

    if (wait.status.isTerminal) {
      _persistTerminalIfNeeded(wait);
      return TerminalScreen(
        slug: widget.slug,
        brand: brand,
        state: wait,
        loadedFromCache: _loadedFromCache,
      );
    }

    final accent = brand != null
        ? PilaPalette.parseAccent(brand.accentColor)
        : PilaPalette.defaultAccent;

    return BrandScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (brand != null) TenantHeader(brand: brand),
          const SizedBox(height: 16),
          ReconnectBanner(visible: !state.connected),
          const SizedBox(height: 16),
          Card(
            margin: EdgeInsets.zero,
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    wait.name,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    wait.position == 1
                        ? "You're next"
                        : 'Position ${wait.position}',
                    style:
                        Theme.of(context).textTheme.displaySmall?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: accent,
                            ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Waiting for ${_formatWaited(_waited)}',
                    style:
                        Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: PilaPalette.neutral500,
                            ),
                  ),
                ],
              ),
            ),
          ),
          const Spacer(),
          OutlinedButton(
            onPressed: _confirmLeave,
            style: OutlinedButton.styleFrom(
              foregroundColor: PilaPalette.danger,
              side: const BorderSide(color: PilaPalette.danger),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: const Text('Leave queue'),
          ),
        ],
      ),
    );
  }
}

String _formatWaited(Duration d) {
  if (d.inMinutes < 1) return '${d.inSeconds}s';
  if (d.inHours < 1) return '${d.inMinutes}m';
  final h = d.inHours;
  final m = d.inMinutes % 60;
  return '${h}h ${m}m';
}
