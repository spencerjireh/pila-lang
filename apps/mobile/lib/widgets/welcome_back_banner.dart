import 'package:flutter/material.dart';

import '../theme/palette.dart';

class WelcomeBackBanner extends StatelessWidget {
  const WelcomeBackBanner({super.key, required this.tenantName});

  final String tenantName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: PilaPalette.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        'Welcome back to $tenantName!',
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: PilaPalette.neutral900,
              fontWeight: FontWeight.w500,
            ),
      ),
    );
  }
}
