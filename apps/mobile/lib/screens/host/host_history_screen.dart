import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:timezone/timezone.dart' as tz;

import '../../api/host_api.dart';
import '../../api/host_models.dart';
import '../../state/host_providers.dart';
import '../../theme/palette.dart';

class HostHistoryScreen extends ConsumerStatefulWidget {
  const HostHistoryScreen({super.key, required this.slug});

  final String slug;

  @override
  ConsumerState<HostHistoryScreen> createState() => _HostHistoryScreenState();
}

class _HostHistoryScreenState extends ConsumerState<HostHistoryScreen> {
  final ScrollController _scroll = ScrollController();
  final List<GuestHistoryRow> _rows = <GuestHistoryRow>[];
  String? _cursor;
  bool _loading = false;
  bool _done = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadMore();
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scroll.position.pixels >=
        _scroll.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_loading || _done) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    final api = ref.read(hostApiProvider);
    try {
      final page = await api.listGuests(
        slug: widget.slug,
        cursor: _cursor,
      );
      if (!mounted) return;
      setState(() {
        _rows.addAll(page.rows);
        _cursor = page.nextCursor;
        _done = page.nextCursor == null;
        _loading = false;
      });
    } on HostApiException catch (err) {
      setState(() {
        _loading = false;
        _error = err.code.name;
      });
    }
  }

  String _formatTimestamp(DateTime when, String? timezone) {
    final formatter = DateFormat('MMM d, yyyy · h:mm a');
    if (timezone == null) return formatter.format(when.toLocal());
    try {
      final location = tz.getLocation(timezone);
      final local = tz.TZDateTime.from(when, location);
      return formatter.format(local);
    } on tz.LocationNotFoundException {
      return formatter.format(when.toLocal());
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(hostQueueControllerProvider(widget.slug));
    final tenantTz = state.snapshot?.tenant.timezone;
    return Scaffold(
      backgroundColor: PilaPalette.neutral50,
      appBar: AppBar(
        title: const Text('Guest history'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/host/${widget.slug}/queue'),
        ),
      ),
      body: SafeArea(
        child: _rows.isEmpty && _loading
            ? const Center(child: CircularProgressIndicator())
            : _rows.isEmpty
                ? _EmptyMessage(error: _error)
                : ListView.separated(
                    controller: _scroll,
                    padding: const EdgeInsets.all(16),
                    itemCount: _rows.length + 1,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      if (index == _rows.length) {
                        return _FooterIndicator(
                          loading: _loading,
                          error: _error,
                          done: _done,
                        );
                      }
                      final row = _rows[index];
                      return _HistoryTile(
                        row: row,
                        lastVisit: _formatTimestamp(row.lastVisitAt, tenantTz),
                      );
                    },
                  ),
      ),
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.row, required this.lastVisit});

  final GuestHistoryRow row;
  final String lastVisit;

  @override
  Widget build(BuildContext context) {
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
                  row.lastName,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                const SizedBox(height: 2),
                Text(
                  row.phone,
                  style: const TextStyle(
                    color: PilaPalette.neutral500,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${row.visitCount} visit${row.visitCount == 1 ? '' : 's'} · last $lastVisit',
                  style: const TextStyle(
                    color: PilaPalette.neutral500,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyMessage extends StatelessWidget {
  const _EmptyMessage({this.error});
  final String? error;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(
          error != null
              ? 'Could not load guests.'
              : 'No guests with a phone number on file yet.',
          textAlign: TextAlign.center,
          style: const TextStyle(color: PilaPalette.neutral500),
        ),
      ),
    );
  }
}

class _FooterIndicator extends StatelessWidget {
  const _FooterIndicator({
    required this.loading,
    required this.error,
    required this.done,
  });

  final bool loading;
  final String? error;
  final bool done;

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (error != null) {
      return const Padding(
        padding: EdgeInsets.all(16),
        child: Text('Could not load more.'),
      );
    }
    if (done) {
      return const SizedBox(height: 24);
    }
    return const SizedBox.shrink();
  }
}
