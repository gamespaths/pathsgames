"""v0.37.5 — match/logbook.py: log rows as their own items, derived state, paging."""
from unittest.mock import patch

from helpers import FakeTable, patch_table
from match import logbook


def _match(**over):
    m = {'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1'}
    m.update(over)
    return m


# ── append / audit ───────────────────────────────────────────────────────────

def test_append_normalises_the_entry_and_queues_it():
    m = _match()
    row = logbook.append(m, 'EVENT', 3, timestamp_ms=1500, characterUuid='c1', idEvent=7,
                         energyCost=2, coinGain=5, message='EVENT_EXECUTED 7')
    assert row is m['_pendingLogs'][0]
    assert row['type'] == 'EVENT' and row['clock'] == 3
    assert row['timestamp'] == '1970-01-01T00:00:01.500Z' and row['timestampMs'] == 1500
    # Every resource field present, whatever the type.
    assert (row['energyCost'], row['coinGain'], row['foodCost'], row['magicGain']) == (2, 5, 0, 0)
    assert row['idEvent'] == 7 and row['characterUuid'] == 'c1'
    # No derived state was touched: executed/selected were not claimed.
    assert 'executedEventIds' not in m and 'eventMarkers' not in m


def test_append_stamps_now_when_no_timestamp_is_given():
    m = _match()
    row = logbook.append(m, 'SLEEP', 1)
    assert row['timestampMs'] > 0 and row['timestamp'].endswith('Z')


def test_an_executed_event_feeds_the_once_set_and_the_markers():
    m = _match()
    logbook.append(m, 'EVENT', 1, executed=True, idEvent=7)
    logbook.append(m, 'EVENT', 1, executed=True, idEvent='7')
    logbook.append(m, 'EVENT', 1, executed=True, idEvent=None)
    assert m['executedEventIds'] == [7]
    assert m['eventMarkers'] == {'7': {'executed': 2, 'selected': 0}}
    assert logbook.consumed_event_ids(m) == {7}
    assert logbook.marker_count(m, 7, 'executed') == 2
    assert logbook.marker_count(m, '7', 'selected') == 0
    assert logbook.marker_count(m, 8, 'executed') == 0
    assert logbook.marker_count({}, 7, 'executed') == 0


def test_a_selected_marker_counts_on_append_and_on_audit():
    m = _match()
    logbook.append(m, 'EVENT', 1, selected=True, idEvent=7)
    logbook.audit(m, 'CHOICE_SELECTED', 1, selected=True, idEvent=7)
    logbook.audit(m, 'CHOICE_SELECTED', 1, selected=True, idEvent=None)
    assert m['eventMarkers']['7'] == {'executed': 0, 'selected': 2}
    assert len(m['_pendingAudit']) == 2 and m['_pendingAudit'][0]['kind'] == 'CHOICE_SELECTED'


def test_a_movement_grows_the_visited_set_in_first_seen_order():
    m = _match()
    logbook.append(m, 'MOVEMENT', None, idLocationFrom=1, idLocationTo=2)
    logbook.append(m, 'MOVEMENT', None, idLocationFrom=2, idLocationTo=None)
    logbook.append(m, 'MOVEMENT', None, idLocationFrom='2', idLocationTo=3)
    assert m['visitedLocationIds'] == [1, 2, 3]
    assert logbook.visited_location_ids(m) == [1, 2, 3]


def test_visited_falls_back_to_the_latched_flags_of_a_legacy_match():
    m = {'locations': [{'idLocation': 4, 'flagVisited': 1}, {'idLocation': 5, 'flagVisited': 0}],
         'visitedLocationIds': [4, 9]}
    assert logbook.visited_location_ids(m) == [4, 9]
    assert logbook.visited_location_ids({'locations': m['locations']}) == [4]
    assert logbook.visited_location_ids({}) == []


# ── persist ──────────────────────────────────────────────────────────────────

def test_persist_writes_the_rows_first_then_the_counted_metadata():
    table = FakeTable([])
    m = _match(logSeq=2, logCount=1, weatherLog=[{'x': 1}], eventLog=[])
    logbook.append(m, 'SLEEP', 1, timestamp_ms=1000)
    logbook.append(m, 'SLEEP', 1, timestamp_ms=1000)
    logbook.audit(m, 'EDGE_STATE', 1, timestamp_ms=1000, message='COMA c1')
    with patch_table(table, module='match.logbook'):
        assert logbook.persist(m) is True

    saved = table.get_item('MATCH#m1')
    assert saved['logSeq'] == 5 and saved['logCount'] == 3
    assert '_pendingLogs' not in saved and '_pendingAudit' not in saved
    # The legacy lists are gone the first time a v0.37.5 write touches the item.
    assert 'weatherLog' not in saved and 'eventLog' not in saved
    # Same ms, unique sort keys, insertion order kept.
    assert [r['SK'] for r in table.logs('m1')] == ['LOG#0000000001000#000003',
                                                    'LOG#0000000001000#000004']
    assert [r['SK'] for r in table.audits('m1')] == ['AUDIT#0000000001000#000005']


def test_persist_with_nothing_pending_only_writes_the_metadata():
    table = FakeTable([])
    m = _match()
    with patch_table(table, module='match.logbook'):
        logbook.persist(m)
    assert table.get_item('MATCH#m1')['logSeq'] == 0
    assert m['logSeq'] == 0 and m['logCount'] == 0
    assert table.logs('m1') == []


def test_persist_derives_the_partition_from_the_uuid_when_pk_is_missing():
    m = {'uuid': 'm1'}
    logbook.append(m, 'SLEEP', 1, timestamp_ms=1)
    written = []
    with patch('match.logbook.db_utils.batch_put_items', side_effect=written.extend), \
         patch('match.logbook.db_utils.put_item', return_value=True):
        logbook.persist(m)
    assert written[0]['PK'] == 'MATCH#m1'


# ── readers ──────────────────────────────────────────────────────────────────

def _rows(n):
    return [{'PK': 'MATCH#m1', 'SK': f'LOG#{1000 * i:013d}#{i:06d}', 'type': 'SLEEP',
             'clock': i, 'timestamp': 't', 'timestampMs': 1000 * i, 'ts_insert': 1}
            for i in range(1, n + 1)]


def test_timeline_entry_strips_bookkeeping_and_defaults_resources():
    entry = logbook.timeline_entry({'PK': 'x', 'SK': 'y', 'ts_insert': 1, 'ts_update': 2,
                                    'timestampMs': 3, 'weatherUuid': 'w', 'kind': 'k',
                                    'type': 'SLEEP', 'energyCost': None})
    assert entry == {'type': 'SLEEP', 'energyCost': 0, 'energyGain': 0, 'foodCost': 0,
                     'foodGain': 0, 'magicCost': 0, 'magicGain': 0, 'coinCost': 0,
                     'coinGain': 0}


def test_page_walks_asc_and_desc_with_a_cursor_that_ends_null():
    table = FakeTable(_rows(5))
    with patch_table(table, module='match.logbook'):
        p1, c1 = logbook.page('m1', 2)
        p2, c2 = logbook.page('m1', 2, c1)
        p3, c3 = logbook.page('m1', 2, c2)
        d1, dc = logbook.page('m1', 3, ascending=False)
        d2, dc2 = logbook.page('m1', 3, dc, ascending=False)
    assert [e['clock'] for e in p1 + p2 + p3] == [1, 2, 3, 4, 5]
    assert c1 and c2 and c3 is None
    assert [e['clock'] for e in d1] == [5, 4, 3] and dc
    assert [e['clock'] for e in d2] == [2, 1] and dc2 is None
    assert 'SK' not in p1[0] and 'ts_insert' not in p1[0]


def test_page_ignores_a_cursor_that_points_elsewhere():
    from common import db_utils
    table = FakeTable(_rows(2))
    with patch_table(table, module='match.logbook'):
        for cursor in ('garbage', db_utils.encode_cursor({'PK': 'MATCH#zz', 'SK': 'LOG#1'}),
                       db_utils.encode_cursor({'PK': 'MATCH#m1', 'SK': 'CHARACTER#c'})):
            entries, nxt = logbook.page('m1', 5, cursor)
            assert [e['clock'] for e in entries] == [1, 2] and nxt is None


def test_page_tolerates_a_failed_query():
    with patch('match.logbook.db_utils.query_sk_prefix_page', return_value=([], None)):
        assert logbook.page('m1', 5) == ([], None)


def test_entries_of_type_filters_on_the_type_attribute():
    rows = _rows(2) + [{'PK': 'MATCH#m1', 'SK': 'LOG#0000000009000#000009', 'type': 'WEATHER'}]
    table = FakeTable(rows)
    with patch_table(table, module='match.logbook'):
        out = logbook.entries_of_type('m1', 'WEATHER')
    assert [r['type'] for r in out] == ['WEATHER']
    with patch('match.logbook.db_utils.query_sk_prefix', return_value=None):
        assert logbook.entries_of_type('m1', 'WEATHER') == []


def test_ms_to_iso_edge_cases():
    assert logbook.ms_to_iso(None) is None
    assert logbook.ms_to_iso(0) == '1970-01-01T00:00:00.000Z'
    assert logbook.ms_to_iso('junk') == 'junk'
