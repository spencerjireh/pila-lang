import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../deeplink/parser.dart';
import '../deeplink/router.dart';
import '../theme/palette.dart';

/// Pure routing decision for a scanned QR payload. Returns a go_router
/// location string on success, or null if the payload is not a
/// recognized Pila link. Exposed at module level so tests can exercise
/// it without standing up MobileScanner's platform channel.
String? resolveScanLocation(String raw, {DeepLinkParser parser = const DeepLinkParser()}) {
  final link = parser.parse(raw);
  if (link is UnknownLink) return null;
  return deepLinkToLocation(link);
}

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  final MobileScannerController _controller = MobileScannerController();
  bool _handled = false;
  DateTime? _lastUnknownAt;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    final value = capture.barcodes.firstOrNull?.rawValue;
    if (value == null) return;
    final location = resolveScanLocation(value);
    if (location != null) {
      _handled = true;
      context.go(location);
      return;
    }
    // Unknown payload: show an inline toast and keep the scanner live.
    // Throttle so a camera pointed at a non-Pila code doesn't spam.
    final now = DateTime.now();
    if (_lastUnknownAt != null &&
        now.difference(_lastUnknownAt!) < const Duration(seconds: 2)) {
      return;
    }
    _lastUnknownAt = now;
    final messenger = ScaffoldMessenger.maybeOf(context);
    messenger?.hideCurrentSnackBar();
    messenger?.showSnackBar(
      const SnackBar(
        content: Text("That's not a Pila QR code."),
        duration: Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PilaPalette.neutral900,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        iconTheme: const IconThemeData(color: Colors.white),
        title: const Text(
          'Scan to join',
          style: TextStyle(color: Colors.white),
        ),
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 2),
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          Positioned(
            bottom: 48,
            left: 24,
            right: 24,
            child: Text(
              'Point the camera at the QR on the restaurant\'s display.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.white,
                backgroundColor: Colors.black.withValues(alpha: 0.5),
                fontSize: 14,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
