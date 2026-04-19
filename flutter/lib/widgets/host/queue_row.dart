import 'dart:async';

import 'package:flutter/material.dart';

import '../../api/host_models.dart';
import '../../theme/palette.dart';

class QueueRow extends StatefulWidget {
  const QueueRow({
    super.key,
    required this.row,
    required this.index,
    required this.canAct,
    required this.onSeat,
    required this.onRemove,
  });

  final HostWaitingRow row;
  final int index;
  final bool canAct;
  final VoidCallback onSeat;
  final VoidCallback onRemove;

  @override
  State<QueueRow> createState() => _QueueRowState();
}

class _QueueRowState extends State<QueueRow> {
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

  String _elapsed() {
    final delta = DateTime.now().difference(widget.row.joinedAt);
    final m = delta.inMinutes;
    final s = delta.inSeconds - m * 60;
    return 'waited ${m}m ${s}s';
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
          _IndexBadge(index: widget.index),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        widget.row.name,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w600,
                          color: PilaPalette.neutral900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (widget.row.phone != null) const _PhoneBadge(),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  'party of ${widget.row.partySize} · ${_elapsed()}',
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: PilaPalette.neutral500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Column(
            children: [
              FilledButton(
                onPressed: widget.canAct ? widget.onSeat : null,
                style: FilledButton.styleFrom(
                  minimumSize: const Size(96, 36),
                ),
                child: const Text('Seat'),
              ),
              const SizedBox(height: 6),
              OutlinedButton(
                onPressed: widget.canAct ? widget.onRemove : null,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(96, 36),
                ),
                child: const Text('Remove'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _IndexBadge extends StatelessWidget {
  const _IndexBadge({required this.index});
  final int index;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: PilaPalette.neutral50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: PilaPalette.neutral200),
      ),
      child: Text(
        '$index',
        style: const TextStyle(
          fontWeight: FontWeight.w600,
          color: PilaPalette.neutral900,
        ),
      ),
    );
  }
}

class _PhoneBadge extends StatelessWidget {
  const _PhoneBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: PilaPalette.neutral50,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: PilaPalette.neutral200),
      ),
      child: const Text(
        'phone',
        style: TextStyle(
          fontSize: 10,
          color: PilaPalette.neutral500,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
