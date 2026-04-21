import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Design-system palette mirroring web's :root CSS variables.
///
/// Token names match `apps/web/app/globals.css`. Whenever the web token
/// hex changes, update here too — they are the brand contract.
class PilaPalette {
  PilaPalette._();

  // Surface
  static const Color background = Color(0xFFF9F5EE); // warm cream
  static const Color foreground = Color(0xFF3A2F25); // deep warm brown
  static const Color card = Color(0xFFF9F5EE);
  static const Color cardForeground = Color(0xFF3A2F25);
  static const Color popover = Color(0xFFFAF7F0);
  static const Color popoverForeground = Color(0xFF3A2F25);

  // Brand
  static const Color primary = Color(0xFF6B7747); // olive / sage
  static const Color primaryForeground = Color(0xFFFAF7F0);
  static const Color secondary = Color(0xFFE7E6DC);
  static const Color secondaryForeground = Color(0xFF3A2F25);

  // Muted / accent
  static const Color muted = Color(0xFFEAE9DD);
  static const Color mutedForeground = Color(0xFF78695A);
  static const Color accent = Color(0xFFC7CFAE);
  static const Color accentForeground = Color(0xFF3A2F25);

  // Status
  static const Color destructive = Color(0xFFA8513A); // warm brick
  static const Color destructiveForeground = Color(0xFFFAF7F0);
  static const Color success = Color(0xFF545F36); // deeper olive
  static const Color successForeground = Color(0xFFFAF7F0);
  static const Color warning = Color(0xFFD59B35); // ochre
  static const Color warningForeground = Color(0xFF2F2316);

  // Edges
  static const Color border = Color(0xFFDAD3C4);
  static const Color input = Color(0xFFDAD3C4);
  static const Color ring = Color(0xFF6B7747);

  /// Default tenant accent when no logo / accent set. Olive-sage matches
  /// the brand. Tenants override per-account in settings.
  static const Color defaultAccent = primary;

  // Legacy aliases — keep call sites compiling while the widget sweep
  // migrates to semantic tokens. New code should use the named tokens
  // (background / foreground / muted / mutedForeground / border /
  // destructive) directly.
  static const Color neutral50 = background;
  static const Color neutral200 = border;
  static const Color neutral500 = mutedForeground;
  static const Color neutral900 = foreground;
  static const Color danger = destructive;

  static Color parseAccent(String? hex) {
    if (hex == null) return defaultAccent;
    final cleaned = hex.replaceAll('#', '').trim();
    if (cleaned.length != 6) return defaultAccent;
    final value = int.tryParse(cleaned, radix: 16);
    if (value == null) return defaultAccent;
    return Color(0xFF000000 | value);
  }

  /// WCAG AA contrast picker: returns black or white, whichever has the
  /// higher contrast ratio against [background]. Mirrors the web helper in
  /// `lib/validators/contrast.ts` so brand rendering matches the server.
  static Color contrastingForeground(Color background) {
    final luminance = _relativeLuminance(background);
    final whiteContrast = 1.05 / (luminance + 0.05);
    final blackContrast = (luminance + 0.05) / 0.05;
    return whiteContrast >= blackContrast ? Colors.white : Colors.black;
  }

  static double _relativeLuminance(Color c) {
    double ch(double d) {
      return d <= 0.03928
          ? d / 12.92
          : math.pow((d + 0.055) / 1.055, 2.4).toDouble();
    }

    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }
}
