import 'package:flutter/material.dart';

import '../../theme/palette.dart';

class OpenClosePill extends StatelessWidget {
  const OpenClosePill({
    super.key,
    required this.isOpen,
    required this.onPressed,
  });

  final bool isOpen;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final fg = isOpen ? PilaPalette.success : PilaPalette.neutral500;
    final bg = isOpen
        ? PilaPalette.success.withValues(alpha: 0.12)
        : PilaPalette.neutral50;
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: fg.withValues(alpha: 0.5)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isOpen ? Icons.circle : Icons.circle_outlined,
              size: 10,
              color: fg,
            ),
            const SizedBox(width: 6),
            Text(
              isOpen ? 'Accepting guests' : 'Closed',
              style: TextStyle(
                color: fg,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
