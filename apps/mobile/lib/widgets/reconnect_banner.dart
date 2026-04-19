import 'package:flutter/material.dart';

import '../theme/palette.dart';

class ReconnectBanner extends StatelessWidget {
  const ReconnectBanner({super.key, required this.visible});

  final bool visible;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      liveRegion: true,
      label: 'Reconnecting',
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 180),
        child: visible
            ? Container(
                key: const ValueKey('banner'),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: PilaPalette.warning.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: PilaPalette.warning.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const SizedBox(
                      height: 14,
                      width: 14,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Reconnecting…',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: PilaPalette.neutral900,
                          ),
                    ),
                  ],
                ),
              )
            : const SizedBox.shrink(key: ValueKey('empty')),
      ),
    );
  }
}
