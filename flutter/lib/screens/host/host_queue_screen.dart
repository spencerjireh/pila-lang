import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../state/host_providers.dart';
import '../../theme/palette.dart';
import '../../widgets/host/open_close_pill.dart';
import '../../widgets/host/queue_row.dart';
import '../../widgets/host/resolved_row.dart';
import '../../widgets/reconnect_banner.dart';
import '../../widgets/tenant_header.dart';

const Duration _recentlyResolvedWindow = Duration(minutes: 30);

class HostQueueScreen extends ConsumerStatefulWidget {
  const HostQueueScreen({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<HostQueueScreen> createState() => _HostQueueScreenState();
}

class _HostQueueScreenState extends ConsumerState<HostQueueScreen>
    with WidgetsBindingObserver {
  HostToast? _shownToast;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller = ref.read(hostQueueControllerProvider(widget.slug).notifier);
    if (state == AppLifecycleState.resumed) {
      controller.onForegrounded();
    } else if (state == AppLifecycleState.paused) {
      controller.onBackgrounded();
    }
  }

  Future<void> _confirmCloseThenToggle() async {
    final state = ref.read(hostQueueControllerProvider(widget.slug));
    final controller = ref.read(hostQueueControllerProvider(widget.slug).notifier);
    final isOpen = state.snapshot?.tenant.isOpen ?? true;
    if (!isOpen) {
      await controller.toggleOpenClose();
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Close the queue?'),
        content: const Text(
          'New guests will see a closed banner. Waiting parties are not affected.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Keep open'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Yes, close'),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await controller.toggleOpenClose();
    }
  }

  void _maybeShowToast(BuildContext context, HostQueueState state) {
    final toast = state.lastToast;
    if (toast == null || identical(toast, _shownToast)) return;
    _shownToast = toast;
    final controller =
        ref.read(hostQueueControllerProvider(widget.slug).notifier);
    final messenger = ScaffoldMessenger.of(context);
    messenger.clearSnackBars();
    messenger.showSnackBar(
      SnackBar(
        backgroundColor:
            toast.isError ? PilaPalette.danger : PilaPalette.neutral900,
        duration: const Duration(seconds: 5),
        content: Text(toast.message),
        action: (!toast.isError && toast.canUndo)
            ? SnackBarAction(
                label: 'Undo',
                onPressed: () => controller.undo(),
              )
            : null,
      ),
    );
    controller.clearToast();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(hostQueueControllerProvider(widget.slug));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _maybeShowToast(context, state);
    });
    return Scaffold(
      backgroundColor: PilaPalette.neutral50,
      body: SafeArea(
        child: state.snapshot == null
            ? const _LoadingView()
            : _QueueContent(
                slug: widget.slug,
                state: state,
                onToggleOpen: _confirmCloseThenToggle,
              ),
      ),
    );
  }
}

class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    return const Center(child: CircularProgressIndicator());
  }
}

class _QueueContent extends ConsumerWidget {
  const _QueueContent({
    required this.slug,
    required this.state,
    required this.onToggleOpen,
  });

  final String slug;
  final HostQueueState state;
  final Future<void> Function() onToggleOpen;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = state.snapshot!;
    final controller = ref.read(hostQueueControllerProvider(slug).notifier);
    final now = DateTime.now();
    final recentlyResolved = snapshot.recentlyResolved
        .where((r) => now.difference(r.resolvedAt) < _recentlyResolvedWindow)
        .toList();
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TenantHeader(
          brand: snapshot.tenant.asTenantBrand(),
          trailing: OpenClosePill(
            isOpen: snapshot.tenant.isOpen,
            onPressed: state.canAct ? () => onToggleOpen() : null,
          ),
        ),
        const SizedBox(height: 12),
        ReconnectBanner(visible: !state.connected),
        if (state.stale) const _StaleBanner(),
        const SizedBox(height: 12),
        Row(
          children: [
            Text(
              'Waiting (${snapshot.waiting.length})',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: PilaPalette.neutral900,
                  ),
            ),
            const Spacer(),
            IconButton(
              tooltip: 'Settings',
              icon: const Icon(Icons.settings),
              onPressed: () => context.go('/host/$slug/settings'),
            ),
            IconButton(
              tooltip: 'Guest history',
              icon: const Icon(Icons.history),
              onPressed: () => context.go('/host/$slug/guests'),
            ),
          ],
        ),
        const SizedBox(height: 8),
        if (snapshot.waiting.isEmpty)
          const _EmptyCard(message: 'No one waiting right now.')
        else
          ...List.generate(snapshot.waiting.length, (i) {
            final row = snapshot.waiting[i];
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: QueueRow(
                row: row,
                index: i + 1,
                canAct: state.canAct,
                onSeat: () => controller.seat(row.id),
                onRemove: () => controller.removeParty(row.id),
              ),
            );
          }),
        if (recentlyResolved.isNotEmpty) ...[
          const SizedBox(height: 24),
          Text(
            'Recently resolved',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: PilaPalette.neutral900,
                ),
          ),
          const SizedBox(height: 8),
          ...recentlyResolved.map(
            (r) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: ResolvedRow(
                row: r,
                canAct: state.canAct,
                onUndo: () => controller.undo(),
              ),
            ),
          ),
        ],
      ],
    );
  }
}

class _StaleBanner extends StatelessWidget {
  const _StaleBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: PilaPalette.warning.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: const Row(
        children: [
          Icon(Icons.warning_amber_rounded, color: PilaPalette.warning, size: 18),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Showing last known state. Reconnect to see changes.',
              style: TextStyle(color: PilaPalette.neutral900, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 24),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: PilaPalette.neutral200,
          style: BorderStyle.solid,
          width: 1.5,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        message,
        style: const TextStyle(color: PilaPalette.neutral500),
      ),
    );
  }
}
