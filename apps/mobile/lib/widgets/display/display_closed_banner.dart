import 'package:flutter/material.dart';

import '../../theme/palette.dart';

class DisplayClosedBanner extends StatelessWidget {
  const DisplayClosedBanner({super.key, required this.tenantName});

  final String tenantName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 40),
      constraints: const BoxConstraints(maxWidth: 560),
      decoration: BoxDecoration(
        color: PilaPalette.muted,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: PilaPalette.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'Not accepting guests right now',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 12),
          Text(
            '$tenantName has paused the queue.',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: PilaPalette.mutedForeground,
                ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
