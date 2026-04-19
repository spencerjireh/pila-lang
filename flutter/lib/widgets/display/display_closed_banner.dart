import 'package:flutter/material.dart';

class DisplayClosedBanner extends StatelessWidget {
  const DisplayClosedBanner({super.key, required this.tenantName});

  final String tenantName;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 40),
      constraints: const BoxConstraints(maxWidth: 560),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
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
            '$tenantName is currently closed. Please check back later.',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                  color: const Color(0xFF475569),
                ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
