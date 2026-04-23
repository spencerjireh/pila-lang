import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../persistence/display_pairing_store.dart';

final displayPairingStoreProvider = Provider<DisplayPairingStore>((ref) {
  throw UnimplementedError(
    'displayPairingStoreProvider must be overridden at app startup '
    '(SqfliteDisplayPairingStore.fromDatabase for prod, '
    'InMemoryDisplayPairingStore for tests)',
  );
});

/// Matches the server's slug allow-list in `lib/validators/slug.ts`:
/// lowercase letters, digits, and hyphens, 3–32 chars, not starting or
/// ending with a hyphen.
final RegExp _slugPattern =
    RegExp(r'^[a-z0-9]([a-z0-9-]{1,30}[a-z0-9])?$');

class DisplayPairingScreen extends ConsumerStatefulWidget {
  const DisplayPairingScreen({super.key});

  @override
  ConsumerState<DisplayPairingScreen> createState() =>
      _DisplayPairingScreenState();
}

class _DisplayPairingScreenState extends ConsumerState<DisplayPairingScreen> {
  final TextEditingController _controller = TextEditingController();
  String? _error;
  bool _submitting = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final value = _controller.text.trim().toLowerCase();
    if (!_slugPattern.hasMatch(value)) {
      setState(() {
        _error = 'Slugs are 3–32 lowercase letters, digits, and hyphens.';
      });
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final store = ref.read(displayPairingStoreProvider);
    await store.pair(value);
    if (!mounted) return;
    context.go('/display/$value');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Pair this kiosk',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'Enter the tenant slug to start displaying the QR.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                  ),
                  const SizedBox(height: 24),
                  TextField(
                    controller: _controller,
                    autofocus: true,
                    textCapitalization: TextCapitalization.none,
                    decoration: InputDecoration(
                      labelText: 'Tenant slug',
                      hintText: 'demo',
                      border: const OutlineInputBorder(),
                      errorText: _error,
                    ),
                    onSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Pair'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
