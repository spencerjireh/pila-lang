import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../api/models.dart';
import '../theme/palette.dart';
import '../widgets/brand_scaffold.dart';
import '../widgets/tenant_header.dart';

class TerminalScreen extends StatelessWidget {
  const TerminalScreen({
    super.key,
    required this.slug,
    required this.state,
    this.brand,
    this.loadedFromCache = false,
  });

  final String slug;
  final WaitState state;
  final TenantBrand? brand;
  final bool loadedFromCache;

  @override
  Widget build(BuildContext context) {
    final copy = _copyFor(state.status);
    final accent = brand != null
        ? PilaPalette.parseAccent(brand!.accentColor)
        : PilaPalette.defaultAccent;
    return BrandScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (brand != null) TenantHeader(brand: brand!),
          const Spacer(),
          Icon(copy.icon, size: 72, color: accent),
          const SizedBox(height: 24),
          Text(
            copy.title,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: PilaPalette.neutral900,
                ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            copy.body,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: PilaPalette.neutral500,
                ),
            textAlign: TextAlign.center,
          ),
          const Spacer(),
          TextButton(
            onPressed: () => context.go('/'),
            child: const Text('Back to home'),
          ),
        ],
      ),
    );
  }

  _TerminalCopy _copyFor(PartyStatus status) {
    switch (status) {
      case PartyStatus.seated:
        return const _TerminalCopy(
          icon: Icons.check_circle_outline,
          title: 'Your table is ready',
          body: 'Head back to the host stand — someone will seat you shortly.',
        );
      case PartyStatus.left:
        return const _TerminalCopy(
          icon: Icons.exit_to_app,
          title: "You've left the queue",
          body: 'Scan the QR again any time to rejoin.',
        );
      case PartyStatus.noShow:
        return const _TerminalCopy(
          icon: Icons.timer_off_outlined,
          title: 'Queue session ended',
          body: 'Please see the host stand if this was a mistake.',
        );
      case PartyStatus.cancelled:
        return const _TerminalCopy(
          icon: Icons.info_outline,
          title: 'This session has ended',
          body: 'Scan the QR on the display to start a new one.',
        );
      case PartyStatus.waiting:
        return const _TerminalCopy(
          icon: Icons.hourglass_empty,
          title: 'Still waiting',
          body: 'You should be on the wait screen — please refresh.',
        );
    }
  }
}

class _TerminalCopy {
  const _TerminalCopy({
    required this.icon,
    required this.title,
    required this.body,
  });
  final IconData icon;
  final String title;
  final String body;
}
