import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

import 'palette.dart';

/// Builds the Pila Lang ThemeData. Mirrors the design system tokens in
/// `apps/web/app/globals.css` and the Tailwind mapping in
/// `apps/web/tailwind.config.ts`. Use Theme.of(context) widgets — never
/// hardcoded Colors.* or Color(0x...) — so brand changes route through
/// the palette.
ThemeData buildPilaTheme() {
  final base = ThemeData(useMaterial3: true);

  const colorScheme = ColorScheme(
    brightness: Brightness.light,
    primary: PilaPalette.primary,
    onPrimary: PilaPalette.primaryForeground,
    primaryContainer: PilaPalette.accent,
    onPrimaryContainer: PilaPalette.accentForeground,
    secondary: PilaPalette.secondary,
    onSecondary: PilaPalette.secondaryForeground,
    tertiary: PilaPalette.accent,
    onTertiary: PilaPalette.accentForeground,
    error: PilaPalette.destructive,
    onError: PilaPalette.destructiveForeground,
    surface: PilaPalette.background,
    onSurface: PilaPalette.foreground,
    surfaceContainerHighest: PilaPalette.muted,
    onSurfaceVariant: PilaPalette.mutedForeground,
    outline: PilaPalette.border,
    outlineVariant: PilaPalette.border,
  );

  final textTheme = _textTheme(base.textTheme);

  return base.copyWith(
    colorScheme: colorScheme,
    scaffoldBackgroundColor: PilaPalette.background,
    canvasColor: PilaPalette.background,
    dividerColor: PilaPalette.border,
    textTheme: textTheme,
    appBarTheme: const AppBarTheme(
      backgroundColor: PilaPalette.background,
      foregroundColor: PilaPalette.foreground,
      elevation: 0,
      centerTitle: false,
      surfaceTintColor: Colors.transparent,
    ),
    cardTheme: const CardThemeData(
      color: PilaPalette.card,
      elevation: 0,
      shape: RoundedRectangleBorder(
        side: BorderSide(color: PilaPalette.border),
        borderRadius: BorderRadius.all(Radius.circular(8)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: PilaPalette.background,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: PilaPalette.input),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: PilaPalette.input),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: PilaPalette.ring, width: 2),
      ),
      hintStyle: const TextStyle(color: PilaPalette.mutedForeground),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: PilaPalette.primary,
        foregroundColor: PilaPalette.primaryForeground,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w500),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: PilaPalette.primary,
        foregroundColor: PilaPalette.primaryForeground,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w500),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: PilaPalette.foreground,
        side: const BorderSide(color: PilaPalette.input),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w500),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: PilaPalette.primary,
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w500),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: PilaPalette.foreground,
      contentTextStyle: TextStyle(color: PilaPalette.background),
      behavior: SnackBarBehavior.floating,
    ),
    iconTheme: const IconThemeData(color: PilaPalette.foreground),
  );
}

TextTheme _textTheme(TextTheme base) {
  // Inter for body / UI; Fraunces for display moments via copyWith on
  // the largest sizes only (display + headline). Keep mono off the
  // global theme — apply per-instance via GoogleFonts.jetBrainsMono.
  final inter = GoogleFonts.interTextTheme(base);
  final fraunces = GoogleFonts.frauncesTextTheme(base);
  return inter.copyWith(
    displayLarge: fraunces.displayLarge?.copyWith(
      fontWeight: FontWeight.w600,
      color: PilaPalette.foreground,
    ),
    displayMedium: fraunces.displayMedium?.copyWith(
      fontWeight: FontWeight.w600,
      color: PilaPalette.foreground,
    ),
    displaySmall: fraunces.displaySmall?.copyWith(
      fontWeight: FontWeight.w600,
      color: PilaPalette.foreground,
    ),
    headlineLarge: fraunces.headlineLarge?.copyWith(
      fontWeight: FontWeight.w600,
      color: PilaPalette.foreground,
    ),
    headlineMedium: fraunces.headlineMedium?.copyWith(
      fontWeight: FontWeight.w600,
      color: PilaPalette.foreground,
    ),
    headlineSmall: fraunces.headlineSmall?.copyWith(
      fontWeight: FontWeight.w600,
      color: PilaPalette.foreground,
    ),
  );
}
