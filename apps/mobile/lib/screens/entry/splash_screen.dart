import 'package:flutter/material.dart';

import '../../theme/palette.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: PilaPalette.neutral50,
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.restaurant_menu,
              size: 56,
              color: PilaPalette.defaultAccent,
            ),
            const SizedBox(height: 16),
            Text(
              'Pila',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    color: PilaPalette.neutral900,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 24),
            const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ],
        ),
      ),
    );
  }
}
