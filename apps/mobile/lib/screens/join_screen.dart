import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../api/models.dart';
import '../auth/bearer_storage.dart';
import '../persistence/party_store.dart';
import '../state/guest_providers.dart';
import '../theme/palette.dart';
import '../widgets/brand_scaffold.dart';
import '../widgets/tenant_header.dart';

class JoinScreen extends ConsumerStatefulWidget {
  const JoinScreen({super.key, required this.slug, required this.token});

  final String slug;
  final String token;

  @override
  ConsumerState<JoinScreen> createState() => _JoinScreenState();
}

class _JoinScreenState extends ConsumerState<JoinScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final TextEditingController _name = TextEditingController();
  final TextEditingController _phone = TextEditingController();
  int _partySize = 2;
  bool _submitting = false;
  String? _error;
  GuestInfoResponse? _info;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadInfo();
  }

  Future<void> _loadInfo() async {
    try {
      final api = ref.read(guestApiProvider);
      final info = await api.fetchInfo(widget.slug, token: widget.token);
      if (!mounted) return;
      setState(() {
        _info = info;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'network';
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    final api = ref.read(guestApiProvider);
    final storage = ref.read(bearerStorageProvider);
    final store = ref.read(partyStoreProvider);
    try {
      final result = await api.joinAndExchange(
        slug: widget.slug,
        qrToken: widget.token,
        input: JoinInput(
          name: _name.text.trim(),
          partySize: _partySize,
          phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        ),
        onBearerIssued: (bearer) async {
          await storage.write(BearerScope.guest, bearer.token);
        },
      );
      await store.upsert(
        GuestPartyRecord(
          slug: widget.slug,
          partyId: result.partyId,
          name: _name.text.trim(),
          partySize: _partySize,
          joinedAt: DateTime.now(),
          status: PartyStatus.waiting,
          updatedAt: DateTime.now(),
        ),
      );
      if (!mounted) return;
      ref.read(currentSessionProvider.notifier).state =
          CurrentSession(slug: widget.slug, partyId: result.partyId);
      context.go('/r/${widget.slug}/wait/${result.partyId}');
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'submit_failed';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const BrandScaffold(
        child: Center(child: CircularProgressIndicator()),
      );
    }
    final info = _info;
    if (info == null) {
      return const BrandScaffold(
        child: _ErrorBanner(message: 'Could not reach the restaurant.'),
      );
    }

    final brand = info.brand;
    if (!brand.isOpen) {
      return BrandScaffold(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TenantHeader(brand: brand),
            const SizedBox(height: 32),
            _Banner(
              title: 'Not accepting guests right now',
              body: '${brand.name} is currently closed. '
                  'Please check back later.',
            ),
          ],
        ),
      );
    }

    if (info.tokenStatus != TokenStatus.ok) {
      return BrandScaffold(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TenantHeader(brand: brand),
            const SizedBox(height: 32),
            _Banner(
              title: info.tokenStatus == TokenStatus.expired
                  ? 'This QR code has expired'
                  : 'This QR code isn\'t valid',
              body: 'Please scan the code on the display to join the queue.',
            ),
          ],
        ),
      );
    }

    return BrandScaffold(
      child: Form(
        key: _formKey,
        child: ListView(
          children: [
            TenantHeader(brand: brand),
            const SizedBox(height: 32),
            Text(
              'Join the queue',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _name,
              autofocus: true,
              textCapitalization: TextCapitalization.words,
              maxLength: 80,
              decoration: const InputDecoration(
                labelText: 'Your name',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Please enter your name.';
                }
                return null;
              },
            ),
            const SizedBox(height: 16),
            _PartySizeField(
              value: _partySize,
              onChanged: (v) => setState(() => _partySize = v),
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              inputFormatters: [
                FilteringTextInputFormatter.allow(RegExp(r'[0-9+]')),
              ],
              decoration: const InputDecoration(
                labelText: 'Phone (optional)',
                hintText: '+1 555 0100',
                border: OutlineInputBorder(),
              ),
              validator: (value) {
                final v = value?.trim() ?? '';
                if (v.isEmpty) return null;
                if (!RegExp(r'^\+[1-9]\d{5,14}$').hasMatch(v)) {
                  return 'Include country code, e.g. +1 555 0100.';
                }
                return null;
              },
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              _ErrorBanner(message: _errorMessage(_error!)),
            ],
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _submitting ? null : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: PilaPalette.parseAccent(brand.accentColor),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _submitting
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Join queue'),
            ),
          ],
        ),
      ),
    );
  }

  String _errorMessage(String code) {
    switch (code) {
      case 'network':
        return 'Could not reach the restaurant. Try again?';
      case 'submit_failed':
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}

class _PartySizeField extends StatelessWidget {
  const _PartySizeField({required this.value, required this.onChanged});
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: const InputDecoration(
        labelText: 'Party size',
        border: OutlineInputBorder(),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: value > 1 ? () => onChanged(value - 1) : null,
            icon: const Icon(Icons.remove),
          ),
          Text('$value', style: Theme.of(context).textTheme.titleLarge),
          IconButton(
            onPressed: value < 20 ? () => onChanged(value + 1) : null,
            icon: const Icon(Icons.add),
          ),
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.title, required this.body});
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: PilaPalette.neutral200,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 8),
          Text(
            body,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: PilaPalette.neutral500,
                ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: PilaPalette.danger.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: const TextStyle(color: PilaPalette.danger),
      ),
    );
  }
}
