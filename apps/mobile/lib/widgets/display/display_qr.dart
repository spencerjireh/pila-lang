import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../../theme/palette.dart';

/// The QR card rendered centered on the display screen. The popover-bg
/// ring keeps contrast high against the cream kiosk backdrop. The token
/// value is used as the `AnimatedSwitcher` key so rotation fades rather
/// than snapping between frames.
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
          color: PilaPalette.popover,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: PilaPalette.border),
        ),
        child: QrImageView(
          data: joinUrl,
          size: size,
          backgroundColor: PilaPalette.popover,
          eyeStyle: const QrEyeStyle(
            eyeShape: QrEyeShape.square,
            color: PilaPalette.foreground,
          ),
          dataModuleStyle: const QrDataModuleStyle(
            dataModuleShape: QrDataModuleShape.square,
            color: PilaPalette.foreground,
          ),
          errorCorrectionLevel: QrErrorCorrectLevel.M,
          semanticsLabel: 'QR code to join the queue',
        ),
      ),
    );
  }
}
