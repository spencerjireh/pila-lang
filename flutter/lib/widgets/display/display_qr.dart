import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

/// The QR card rendered centered on the display screen. The white ring
/// keeps contrast high against the black kiosk backdrop. The token value
/// is used as the `AnimatedSwitcher` key so rotation fades rather than
/// snapping between frames.
class DisplayQr extends StatelessWidget {
  const DisplayQr({
    super.key,
    required this.joinUrl,
    required this.token,
    this.size = 360,
  });

  final String joinUrl;
  final String token;
  final double size;

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: Container(
        key: ValueKey<String>(token),
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: const [
            BoxShadow(
              color: Color(0x33000000),
              blurRadius: 32,
              offset: Offset(0, 12),
            ),
          ],
        ),
        child: QrImageView(
          data: joinUrl,
          size: size,
          backgroundColor: Colors.white,
          errorCorrectionLevel: QrErrorCorrectLevel.M,
          semanticsLabel: 'QR code to join the queue',
        ),
      ),
    );
  }
}
