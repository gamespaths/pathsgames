"""Shared test helpers for building Lambda event dicts."""
import json


def make_event(method, path, body=None, headers=None, cookies=None, path_params=None, qs=None):
    """Build a minimal API Gateway HTTP v2 event dict."""
    event = {
        'rawPath': path,
        'requestContext': {'http': {'method': method}},
        'headers': headers or {},
        'pathParameters': path_params or {},
        'queryStringParameters': qs or {},
    }
    if body is not None:
        event['body'] = json.dumps(body) if isinstance(body, dict) else body
    if cookies:
        event['cookies'] = cookies
    return event


def admin_event(method, path, **kwargs):
    """Build an event with a MOCK_ACCESS_ admin Bearer token."""
    headers = kwargs.pop('headers', {})
    headers['Authorization'] = 'Bearer MOCK_ACCESS_admin-uuid-001'
    return make_event(method, path, headers=headers, **kwargs)


# ── v0.37.5 — in-memory DynamoDB stand-in shared by the handler suites ─────────

class FakeTable:
    """Dict-backed table exposing the db_utils calls the match handler makes."""

    def __init__(self, items=()):
        self.store = {(i['PK'], i.get('SK', 'METADATA')): dict(i) for i in items}

    def get_item(self, pk, sk='METADATA', consistent=True):
        it = self.store.get((pk, sk))
        return dict(it) if it else None

    def put_item(self, item):
        self.store[(item.get('PK'), item.get('SK', 'METADATA'))] = dict(item)
        return True

    def batch_put_items(self, items):
        for item in items:
            self.put_item(item)
        return True

    def delete_item(self, pk, sk='METADATA'):
        self.store.pop((pk, sk), None)
        return True

    def delete_all_by_pk(self, pk):
        keys = [k for k in self.store if k[0] == pk]
        for k in keys:
            del self.store[k]
        return len(keys)

    def query_by_pk(self, pk):
        return [dict(v) for (p, _), v in sorted(self.store.items()) if p == pk]

    def query_sk_prefix(self, pk, sk_prefix, consistent=True, filter_expr=None):
        rows = [dict(v) for (p, s), v in sorted(self.store.items())
                if p == pk and s.startswith(sk_prefix)]
        if filter_expr is not None:
            # Only Attr('type').eq(value) is used by the code under test.
            wanted = filter_expr._values[1]
            rows = [r for r in rows if r.get('type') == wanted]
        return rows

    def query_sk_prefix_page(self, pk, sk_prefix, limit, start_key=None, ascending=True,
                             consistent=False):
        rows = self.query_sk_prefix(pk, sk_prefix)
        if not ascending:
            rows.reverse()
        if start_key:
            idx = next((i for i, r in enumerate(rows) if r['SK'] == start_key.get('SK')), None)
            rows = rows[idx + 1:] if idx is not None else rows
        page = rows[:int(limit)]
        last = {'PK': page[-1]['PK'], 'SK': page[-1]['SK']} if len(rows) > len(page) else None
        return page, last

    # ── inspection helpers ──
    def rows(self, pk, prefix):
        return [v for (p, s), v in sorted(self.store.items()) if p == pk and s.startswith(prefix)]

    def logs(self, match_uuid):
        return self.rows(f'MATCH#{match_uuid}', 'LOG#')

    def audits(self, match_uuid):
        """The audit entries, unpacked from the one AUDIT# row each persist writes."""
        return [e for r in self.rows(f'MATCH#{match_uuid}', 'AUDIT#') for e in (r.get('rows') or [])]


DB_FUNCTIONS = ('get_item', 'put_item', 'batch_put_items', 'delete_item', 'delete_all_by_pk',
                'query_by_pk', 'query_sk_prefix', 'query_sk_prefix_page')


def patch_table(table, module='match.handler'):
    """Every db_utils call of ``module`` answered by ``table`` (an ExitStack of patches)."""
    from contextlib import ExitStack
    from unittest.mock import patch
    stack = ExitStack()
    for name in DB_FUNCTIONS:
        stack.enter_context(patch(f'{module}.db_utils.{name}', side_effect=getattr(table, name)))
    return stack


def pending_logs(match):
    """The timeline rows queued on a match dict and not yet persisted."""
    return list(match.get('_pendingLogs') or [])


def pending_audits(match):
    return list(match.get('_pendingAudit') or [])


class RowSink:
    """Collects every row a request flushes (match/repo.py) when no FakeTable is in play."""

    def __init__(self):
        self.rows = []

    def batch_put_items(self, items):
        self.rows.extend(dict(i) for i in items)
        return True

    def logs(self):
        return [r for r in self.rows if str(r.get('SK', '')).startswith('LOG#')]

    def audit_items(self):
        """The AUDIT# rows as written: one per persist, the entries packed in ``rows``."""
        return [r for r in self.rows if str(r.get('SK', '')).startswith('AUDIT#')]

    def audits(self):
        """The audit entries, unpacked from the one AUDIT# row each persist writes."""
        return [e for r in self.audit_items() for e in (r.get('rows') or [])]

    def items(self, prefix=''):
        """The non-log rows (METADATA, CHARACTER#, TURN#…) whose SK starts with ``prefix``."""
        return [r for r in self.rows
                if str(r.get('SK', '')).startswith(prefix)
                and not str(r.get('SK', '')).startswith(('LOG#', 'AUDIT#'))]

    def saved(self, sk='METADATA'):
        """The last flushed row with this exact SK, or None."""
        rows = [r for r in self.rows if r.get('SK', 'METADATA') == sk]
        return rows[-1] if rows else None


SINK = RowSink()
REAL_BATCH_PUT = None   # the unpatched db_utils.batch_put_items, set by conftest


def written_rows():
    """The rows batch-written since the current test started (see conftest)."""
    return SINK


def derived_from_log(rows):
    """v0.37.5 — the executedEventIds / eventMarkers a legacy eventLog list would have
    produced, so a fixture can still describe a match by the rows it once carried."""
    executed, markers = [], {}
    for row in rows or []:
        id_event = row.get('idEvent')
        message = str(row.get('message') or '')
        if id_event is None:
            continue
        slot = markers.setdefault(str(int(id_event)), {'executed': 0, 'selected': 0})
        if message.startswith('EVENT_EXECUTED'):
            slot['executed'] += 1
            if int(id_event) not in executed:
                executed.append(int(id_event))
        elif message.startswith('CHOICE_SELECTED'):
            slot['selected'] += 1
    return {'executedEventIds': executed, 'eventMarkers': markers}
