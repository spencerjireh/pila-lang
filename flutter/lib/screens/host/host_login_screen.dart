import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../api/host_api.dart';
import '../../state/host_providers.dart';
import '../../theme/palette.dart';
import '../../widgets/brand_scaffold.dart';

class HostLoginScreen extends ConsumerStatefulWidget {
  const HostLoginScreen({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<HostLoginScreen> createState() => _HostLoginScreenState();
}

class _HostLoginScreenState extends ConsumerState<HostLoginScreen> {
  final TextEditingController _password = TextEditingController();
  bool _busy = false;
  String? _error;
  int? _rateLimitRemainingSec;
  Timer? _countdown;

  @override
  void dispose() {
    _password.dispose();
    _countdown?.cancel();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    final pw = _password.text;
    if (pw.isEmpty) {
      setState(() => _error = 'Enter the shared host password.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    final api = ref.read(hostApiProvider);
    final auth = ref.read(hostAuthControllerProvider);
    try {
      final res = await api.exchangeToken(slug: widget.slug, password: pw);
      await auth.adopt(res.token);
      if (!mounted) return;
      context.go('/host/${widget.slug}/queue');
    } on HostApiException catch (err) {
      setState(() {
        _busy = false;
        _error = _messageFor(err);
        if (err.code == HostApiError.rateLimited &&
            err.retryAfterSeconds != null) {
          _armCountdown(err.retryAfterSeconds!);
        }
      });
    } catch (_) {
      setState(() {
        _busy = false;
        _error = 'Network error. Please try again.';
      });
    }
  }

  void _armCountdown(int seconds) {
    _rateLimitRemainingSec = seconds;
    _countdown?.cancel();
    _countdown = Timer.periodic(const Duration(seconds: 1), (t) {
      final remaining = (_rateLimitRemainingSec ?? 0) - 1;
      if (remaining <= 0) {
        t.cancel();
        setState(() {
          _rateLimitRemainingSec = null;
          _error = null;
        });
      } else {
        setState(() {
          _rateLimitRemainingSec = remaining;
          _error = 'Too many attempts. Try again in ${remaining}s.';
        });
      }
    });
  }

  String _messageFor(HostApiException err) {
    switch (err.code) {
      case HostApiError.unauthorized:
        return 'Wrong password. Check with your manager.';
      case HostApiError.rateLimited:
        final s = err.retryAfterSeconds ?? 60;
        return 'Too many attempts. Try again in ${s}s.';
      case HostApiError.network:
        return 'Network error. Please try again.';
      default:
        return 'Could not sign in. Please try again.';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return BrandScaffold(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 32),
          Text(
            'Host sign-in',
            style: theme.textTheme.headlineSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: PilaPalette.neutral900,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            widget.slug,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: PilaPalette.neutral500,
            ),
          ),
          const SizedBox(height: 32),
          TextField(
            controller: _password,
            obscureText: true,
            autofillHints: const <String>[AutofillHints.password],
            decoration: const InputDecoration(
              labelText: 'Shared password',
              border: OutlineInputBorder(),
            ),
            onSubmitted: (_) => _submit(),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(
              _error!,
              style: const TextStyle(color: PilaPalette.danger),
            ),
          ],
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _busy ? null : _submit,
              child: Text(_busy ? 'Signing in…' : 'Sign in'),
            ),
          ),
        ],
      ),
    );
  }
}
