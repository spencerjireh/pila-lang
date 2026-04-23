import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../kiosk/kiosk_mode.dart';
import '../../state/display_providers.dart';
import '../../theme/palette.dart';
import '../../widgets/display/display_closed_banner.dart';
import '../../widgets/display/display_qr.dart';
import 'display_pairing_screen.dart';

class DisplayScreen extends ConsumerStatefulWidget {
  const DisplayScreen({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<DisplayScreen> createState() => _DisplayScreenState();
}

class _DisplayScreenState extends ConsumerState<DisplayScreen>
    with WidgetsBindingObserver {
  final KioskMode _kiosk = const KioskMode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _kiosk.activate();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final controller =
        ref.read(displayControllerProvider(widget.slug).notifier);
    switch (state) {
      case AppLifecycleState.resumed:
        controller.onForegrounded();
      case AppLifecycleState.paused:
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
        controller.onBackgrounded();
      case AppLifecycleState.detached:
        break;
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _kiosk.deactivate();
    super.dispose();
  }

  Future<void> _enterPairing() async {
    final store = ref.read(displayPairingStoreProvider);
    await store.clear();
    if (!mounted) return;
    context.go('/display');
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(displayControllerProvider(widget.slug));
    final tenant = state.tenant;
    final joinUrl = state.joinUrl;
    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            AbsorbPointer(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (tenant != null)
                      _DisplayTenantHeader(
                        name: tenant.name,
                        logoUrl: tenant.logoUrl,
                        accentColor: tenant.accentColor,
                      )
                    else
                      const SizedBox(height: 80),
                    const SizedBox(height: 16),
                    Expanded(
                      child: Center(
                        child: state.isOpen
                            ? _OpenBody(
                                joinUrl: joinUrl,
                                token: state.token,
                              )
                            : DisplayClosedBanner(
                                tenantName: tenant?.name ?? '',
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              top: 0,
              left: 0,
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onLongPress: _enterPairing,
                child: const SizedBox(
                  width: 80,
                  height: 80,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OpenBody extends StatelessWidget {
  const _OpenBody({required this.joinUrl, required this.token});

  final String? joinUrl;
  final String? token;

  @override
  Widget build(BuildContext context) {
    if (joinUrl == null || token == null) {
      return const _DisplayLoading();
    }
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        DisplayQr(joinUrl: joinUrl!, token: token!),
        const SizedBox(height: 24),
        const Text(
          'Scan to join the queue',
          style: TextStyle(
            color: PilaPalette.foreground,
            fontSize: 22,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class _DisplayLoading extends StatelessWidget {
  const _DisplayLoading();

  @override
  Widget build(BuildContext context) {
    return const CircularProgressIndicator(color: PilaPalette.primary);
  }
}

/// Slim dark-mode variant of [TenantHeader] for the kiosk backdrop — the
/// shared widget assumes a light background. Avatar + name only; the
/// display never renders a trailing action.
class _DisplayTenantHeader extends StatelessWidget {
  const _DisplayTenantHeader({
    required this.name,
    required this.logoUrl,
    required this.accentColor,
  });

  final String name;
  final String? logoUrl;
  final String accentColor;

  String get _initials {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    final first = parts.first.substring(0, 1);
    if (parts.length == 1) return first.toUpperCase();
    return (first + parts[1].substring(0, 1)).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final accent = PilaPalette.parseAccent(accentColor);
    final logo = logoUrl;
    final avatar = logo != null
        ? CircleAvatar(
            backgroundImage: NetworkImage(logo),
            radius: 36,
          )
        : CircleAvatar(
            backgroundColor: accent,
            radius: 36,
            child: Text(
              _initials,
              style: TextStyle(
                color: PilaPalette.contrastingForeground(accent),
                fontWeight: FontWeight.w700,
                fontSize: 28,
              ),
            ),
          );
    return Row(
      children: [
        avatar,
        const SizedBox(width: 16),
        Expanded(
          child: Text(
            name,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: PilaPalette.foreground,
              fontSize: 32,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
