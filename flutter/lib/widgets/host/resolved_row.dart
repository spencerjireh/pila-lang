import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/host_models.dart';
import '../../api/models.dart';
import '../../theme/palette.dart';

/// Undo eligibility window — matches `lib/parties/undo-store.ts` on the server.
const Duration kUndoWindow = Duration(seconds: 60);

class ResolvedRow extends StatefulWidget {
  const ResolvedRow({
    super.key,
    required this.row,
    required this.canAct,
    required this.onUndo,
  });

  final HostRecentlyResolvedRow row;
  final bool canAct;
  final VoidCallback onUndo;

  @override
  State<ResolvedRow> createState() => _ResolvedRowState();
}

class _ResolvedRowState extends State<ResolvedRow> {
  late Timer _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker.cancel();
    super.dispose();
  }

  bool get _undoOpen {
    final elapsed = DateTime.now().difference(widget.row.resolvedAt);
    return elapsed < kUndoWindow;
  }

  String _statusLabel() {
    switch (widget.row.status) {
      case PartyStatus.seated:
        return 'seated';
      case PartyStatus.noShow:
        return 'removed';
      case PartyStatus.left:
        return 'left';
      default:
        return widget.row.status.wire;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: PilaPalette.neutral200),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.row.name,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: PilaPalette.neutral900,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${_statusLabel()} · party of ${widget.row.partySize}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: PilaPalette.neutral500,
                  ),
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: (widget.canAct && _undoOpen) ? widget.onUndo : null,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(88, 36),
            ),
            child: const Text('Undo'),
          ),
        ],
      ),
    );
  }
}
