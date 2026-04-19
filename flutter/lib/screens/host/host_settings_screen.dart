import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../api/host_api.dart';
import '../../api/host_models.dart';
import '../../state/host_providers.dart';
import '../../theme/palette.dart';

const int _maxLogoBytes = 500 * 1024; // matches the web 500KB guard

class HostSettingsScreen extends ConsumerStatefulWidget {
  const HostSettingsScreen({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<HostSettingsScreen> createState() => _HostSettingsScreenState();
}

class _HostSettingsScreenState extends ConsumerState<HostSettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final state = ref.watch(hostQueueControllerProvider(widget.slug));
    final tenant = state.snapshot?.tenant;
    return Scaffold(
      backgroundColor: PilaPalette.neutral50,
      appBar: AppBar(
        title: const Text('Settings'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/host/${widget.slug}/queue'),
        ),
      ),
      body: SafeArea(
        child: tenant == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _GeneralSection(slug: widget.slug, tenant: tenant),
                  const SizedBox(height: 16),
                  _BrandingSection(slug: widget.slug, tenant: tenant),
                  const SizedBox(height: 16),
                  _PasswordSection(slug: widget.slug),
                  const SizedBox(height: 24),
                  _SignOutButton(slug: widget.slug),
                ],
              ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PilaPalette.neutral200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _GeneralSection extends ConsumerStatefulWidget {
  const _GeneralSection({required this.slug, required this.tenant});

  final String slug;
  final HostTenantBrand tenant;

  @override
  ConsumerState<_GeneralSection> createState() => _GeneralSectionState();
}

class _GeneralSectionState extends ConsumerState<_GeneralSection> {
  late final TextEditingController _name;
  late final TextEditingController _accent;
  bool _busy = false;
  String? _message;

  @override
  void initState() {
    super.initState();
    _name = TextEditingController(text: widget.tenant.name);
    _accent = TextEditingController(text: widget.tenant.accentColor);
  }

  @override
  void dispose() {
    _name.dispose();
    _accent.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy) return;
    final name = _name.text.trim();
    final accent = _accent.text.trim();
    final nameChanged = name != widget.tenant.name && name.isNotEmpty;
    final accentChanged = accent != widget.tenant.accentColor && accent.isNotEmpty;
    if (!nameChanged && !accentChanged) {
      setState(() => _message = 'Nothing to save.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    final api = ref.read(hostApiProvider);
    try {
      await api.updateGeneral(
        slug: widget.slug,
        name: nameChanged ? name : null,
        accentColor: accentChanged ? accent : null,
      );
      if (!mounted) return;
      setState(() {
        _busy = false;
        _message = 'Saved.';
      });
    } on HostApiException catch (err) {
      setState(() {
        _busy = false;
        _message = _messageForGeneral(err);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final swatch = PilaPalette.parseAccent(_accent.text);
    return _SectionCard(
      title: 'General',
      children: [
        TextField(
          controller: _name,
          decoration: const InputDecoration(
            labelText: 'Restaurant name',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _accent,
                decoration: const InputDecoration(
                  labelText: 'Accent color (hex)',
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox(width: 12),
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: swatch,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: PilaPalette.neutral200),
              ),
            ),
          ],
        ),
        if (_message != null) ...[
          const SizedBox(height: 8),
          Text(
            _message!,
            style: TextStyle(
              color: _message == 'Saved.'
                  ? PilaPalette.success
                  : PilaPalette.danger,
            ),
          ),
        ],
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _busy ? null : _save,
          child: Text(_busy ? 'Saving…' : 'Save'),
        ),
      ],
    );
  }
}

String _messageForGeneral(HostApiException err) {
  switch (err.code) {
    case HostApiError.invalidAccent:
      return 'Accent color must pass AA contrast against black or white.';
    case HostApiError.invalidBody:
      return 'Name or color is invalid.';
    case HostApiError.rateLimited:
      return 'Too many changes, try again shortly.';
    default:
      return 'Could not save. Try again.';
  }
}

class _BrandingSection extends ConsumerStatefulWidget {
  const _BrandingSection({required this.slug, required this.tenant});

  final String slug;
  final HostTenantBrand tenant;

  @override
  ConsumerState<_BrandingSection> createState() => _BrandingSectionState();
}

class _BrandingSectionState extends ConsumerState<_BrandingSection> {
  bool _busy = false;
  String? _message;

  Future<void> _pickAndUpload(ImageSource source) async {
    if (_busy) return;
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: source);
    if (picked == null) return;
    final lower = picked.name.toLowerCase();
    if (lower.endsWith('.svg')) {
      setState(() => _message = 'Only PNG or JPG are supported.');
      return;
    }
    final isPng = lower.endsWith('.png');
    final isJpg = lower.endsWith('.jpg') || lower.endsWith('.jpeg');
    if (!isPng && !isJpg) {
      setState(() => _message = 'Only PNG or JPG are supported.');
      return;
    }
    final size = await picked.length();
    if (size > _maxLogoBytes) {
      setState(() => _message = 'Logo must be under 500KB.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    final api = ref.read(hostApiProvider);
    try {
      await api.uploadLogo(
        slug: widget.slug,
        file: File(picked.path),
        filename: picked.name,
        mimeType: isPng ? 'image/png' : 'image/jpeg',
      );
      if (!mounted) return;
      setState(() {
        _busy = false;
        _message = 'Logo updated.';
      });
    } on HostApiException catch (err) {
      setState(() {
        _busy = false;
        _message = _messageForLogo(err);
      });
    }
  }

  Future<void> _clear() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    final api = ref.read(hostApiProvider);
    try {
      await api.clearLogo(widget.slug);
      if (!mounted) return;
      setState(() {
        _busy = false;
        _message = 'Logo removed.';
      });
    } on HostApiException catch (err) {
      setState(() {
        _busy = false;
        _message = _messageForLogo(err);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final logoUrl = widget.tenant.logoUrl;
    return _SectionCard(
      title: 'Branding',
      children: [
        Row(
          children: [
            if (logoUrl != null)
              CircleAvatar(backgroundImage: NetworkImage(logoUrl), radius: 28)
            else
              const CircleAvatar(
                backgroundColor: PilaPalette.neutral200,
                radius: 28,
                child: Icon(Icons.storefront, color: PilaPalette.neutral500),
              ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                logoUrl == null
                    ? 'No logo set. Upload a PNG or JPG under 500KB.'
                    : 'Logo is live on every branded surface.',
                style: const TextStyle(color: PilaPalette.neutral500),
              ),
            ),
          ],
        ),
        if (_message != null) ...[
          const SizedBox(height: 8),
          Text(
            _message!,
            style: TextStyle(
              color: _message!.endsWith('updated.') || _message!.endsWith('removed.')
                  ? PilaPalette.success
                  : PilaPalette.danger,
            ),
          ),
        ],
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _busy
                    ? null
                    : () => _pickAndUpload(ImageSource.camera),
                icon: const Icon(Icons.photo_camera),
                label: const Text('Camera'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: FilledButton.icon(
                onPressed: _busy
                    ? null
                    : () => _pickAndUpload(ImageSource.gallery),
                icon: const Icon(Icons.photo_library),
                label: const Text('Choose'),
              ),
            ),
          ],
        ),
        if (logoUrl != null) ...[
          const SizedBox(height: 8),
          TextButton(
            onPressed: _busy ? null : _clear,
            child: const Text('Remove logo'),
          ),
        ],
      ],
    );
  }
}

String _messageForLogo(HostApiException err) {
  switch (err.code) {
    case HostApiError.logoTooLarge:
      return 'Logo must be under 500KB.';
    case HostApiError.logoBadMime:
      return 'Only PNG or JPG are supported.';
    case HostApiError.logoBadDimensions:
      return 'Logo must be between 64×64 and 4096×4096 pixels.';
    case HostApiError.logoDecodeFailed:
      return 'Could not read that image.';
    case HostApiError.storageFailed:
      return 'Storage failed. Try again.';
    default:
      return 'Could not save logo.';
  }
}

class _PasswordSection extends ConsumerStatefulWidget {
  const _PasswordSection({required this.slug});

  final String slug;

  @override
  ConsumerState<_PasswordSection> createState() => _PasswordSectionState();
}

class _PasswordSectionState extends ConsumerState<_PasswordSection> {
  final TextEditingController _newPw = TextEditingController();
  bool _busy = false;
  String? _message;

  @override
  void dispose() {
    _newPw.dispose();
    super.dispose();
  }

  Future<void> _rotate() async {
    final pw = _newPw.text;
    if (pw.length < 8) {
      setState(() => _message = 'Password must be at least 8 characters.');
      return;
    }
    setState(() {
      _busy = true;
      _message = null;
    });
    final api = ref.read(hostApiProvider);
    try {
      await api.rotatePassword(slug: widget.slug, newPassword: pw);
      if (!mounted) return;
      _newPw.clear();
      setState(() {
        _busy = false;
        _message = 'Password updated. Other devices are signed out.';
      });
    } on HostApiException catch (err) {
      setState(() {
        _busy = false;
        _message = 'Could not update password (${err.code.name}).';
      });
    }
  }

  Future<void> _logoutOthers() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Sign out all other devices?'),
        content: const Text(
          'Keeps the current password; signs out everyone else on their next action.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: const Text('Yes, sign out others'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    final api = ref.read(hostApiProvider);
    try {
      await api.logoutOthers(widget.slug);
      if (!mounted) return;
      setState(() {
        _busy = false;
        _message = 'Other devices signed out.';
      });
    } on HostApiException catch (err) {
      setState(() {
        _busy = false;
        _message = 'Could not sign out others (${err.code.name}).';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      title: 'Password',
      children: [
        TextField(
          controller: _newPw,
          obscureText: true,
          decoration: const InputDecoration(
            labelText: 'New password',
            border: OutlineInputBorder(),
            helperText: 'Rotating signs out every other device on its next action.',
          ),
        ),
        if (_message != null) ...[
          const SizedBox(height: 8),
          Text(
            _message!,
            style: TextStyle(
              color: _message!.startsWith('Could not') ||
                      _message!.startsWith('Password must')
                  ? PilaPalette.danger
                  : PilaPalette.success,
            ),
          ),
        ],
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: FilledButton(
                onPressed: _busy ? null : _rotate,
                child: Text(_busy ? 'Updating…' : 'Rotate password'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: OutlinedButton(
                onPressed: _busy ? null : _logoutOthers,
                child: const Text('Sign out others'),
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _SignOutButton extends ConsumerStatefulWidget {
  const _SignOutButton({required this.slug});

  final String slug;

  @override
  ConsumerState<_SignOutButton> createState() => _SignOutButtonState();
}

class _SignOutButtonState extends ConsumerState<_SignOutButton> {
  bool _busy = false;

  Future<void> _signOut() async {
    if (_busy) return;
    setState(() => _busy = true);
    final api = ref.read(hostApiProvider);
    final auth = ref.read(hostAuthControllerProvider);
    try {
      await api.logout(widget.slug);
    } on HostApiException {
      // continue — local clear is what actually signs the host out
    }
    await auth.signOut();
    if (!mounted) return;
    context.go('/host/${widget.slug}');
  }

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: _busy ? null : _signOut,
      icon: const Icon(Icons.logout),
      label: Text(_busy ? 'Signing out…' : 'Sign out'),
    );
  }
}
