import 'package:flutter/material.dart';

import '../api/models.dart';
import '../theme/palette.dart';

class TenantHeader extends StatelessWidget {
  const TenantHeader({super.key, required this.brand, this.trailing});

  final TenantBrand brand;
  final Widget? trailing;

  String get _initials {
    final parts = brand.name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    final first = parts.first.substring(0, 1);
    if (parts.length == 1) return first.toUpperCase();
    final second = parts[1].substring(0, 1);
    return (first + second).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final accent = PilaPalette.parseAccent(brand.accentColor);
    final logoUrl = brand.logoUrl;
    final avatar = logoUrl != null
        ? CircleAvatar(
            backgroundImage: NetworkImage(logoUrl),
            radius: 28,
          )
        : CircleAvatar(
            backgroundColor: accent,
            radius: 28,
            child: Text(
              _initials,
              style: TextStyle(
                color: PilaPalette.contrastingForeground(accent),
                fontWeight: FontWeight.w600,
              ),
            ),
          );
    return Row(
      children: [
        avatar,
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            brand.name,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                  color: PilaPalette.neutral900,
                ),
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 12),
          trailing!,
        ],
      ],
    );
  }
}
