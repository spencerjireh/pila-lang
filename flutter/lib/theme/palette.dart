import 'dart:math' as math;

import 'package:flutter/material.dart';

class PilaPalette {
  PilaPalette._();

  // Matches the web Tailwind defaults + the v1 accent fallback.
  static const Color defaultAccent = Color(0xFF1F6FEB);
  static const Color neutral50 = Color(0xFFF8FAFC);
  static const Color neutral200 = Color(0xFFE2E8F0);
  static const Color neutral500 = Color(0xFF64748B);
  static const Color neutral900 = Color(0xFF0F172A);
  static const Color danger = Color(0xFFDC2626);
  static const Color success = Color(0xFF16A34A);
  static const Color warning = Color(0xFFF59E0B);

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
