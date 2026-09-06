"""v0.36.3 — the forced move an event effect applies, and what happens after it.

Two regressions live here. Both only ever showed on this backend, because only this one
reads its own writes back from an eventually consistent store inside a single request:

* an event that ALSO ends the time unit re-read the roster and wrote it back, undoing the
  move it had just applied — the character was returned to where they started;
* a forced move never resolved the ARRIVAL it produced, so the destination's entry events
  did not fire and the response carried no ``automaticEvents``, while java and python both
  drained them.

jwt_utils and db_utils are patched; no AWS calls are made.
"""
import copy
import json
from unittest.mock import patch

from helpers import make_event

USER = {'PK': 'USER#u1', 'SK': 'METADATA', 'uuid': 'u1', 'username': 'guest', 'role': 'PLAYER'}

CHARACTER = {
    'PK': 'MATCH#m1', 'SK': 'CHARACTER#c1', 'uuid': 'c1', 'userUuid': 'u1',
    'idLocation': 1, 'energy': 10, 'coin': 0, 'life': 10, 'exp': 0,
    'isSleeping': 0, 'isComa': 0,
}

MATCH = {
    'PK': 'MATCH#m1', 'SK': 'METADATA', 'uuid': 'm1', 'status': 'RUNNING',
    'currentClock': 1, 'userCreatorUuid': 'u1', 'storyUuid': 's1',
    'locations': [{'idLocation': 1, 'flagVisited': 1}, {'idLocation': 2, 'flagVisited': 0}],
}


def _story(*, flag_end_time=0, entry_event=False):
    """A two-location story whose only event moves the actor from 1 to 2."""
    events = [{'id': 10, 'uuid': 'evt-move', 'idSpecificLocation': 1, 'type': 'NORMAL',
               'costEnery': 0, 'flagEndTime': flag_end_time}]
    locations = [{'id': 1, 'uuid': 'loc-1'}, {'id': 2, 'uuid': 'loc-2'}]
    if entry_event:
        events.append({'id': 20, 'uuid': 'evt-entry', 'type': 'AUTOMATIC', 'idCard': 1})
        locations[1]['idEventIfFirstTime'] = 20
    return {
        'PK': 'STORY#s1', 'SK': 'METADATA', 'uuid': 's1',
        'locations': locations,
        'events': events,
        'eventEffects': [{'id': 1, 'idEvent': 10, 'target': 'ONLY_ONE', 'idLocation': 2},
                         {'id': 2, 'idEvent': 20, 'target': 'ONLY_ONE',
                          'statistics': 'exp', 'value': 3}],
        'raw_cards': [{'id': 1, 'uuid': 'card-1', 'idTextTitle': 201}],
        'raw_texts': [{'idText': 201, 'lang': 'en', 'shortText': 'The gate closes'}],
    }


def _run(story):
    """Execute the moving event against a store that reads back what it was given — what
    ``ConsistentRead`` buys, and what every other backend gets from its transaction."""
    match = copy.deepcopy(MATCH)

    def _get(pk, sk='METADATA'):
        if pk.startswith('USER#'):
            return USER
        if pk.startswith('MATCH#'):
            return match
        if pk.startswith('STORY#'):
            return story
        return None

    written = []
    event = make_event('POST', '/api/gameplay/m1/action/execute-event',
                       body={'eventUuid': 'evt-move'},
                       headers={'Authorization': 'Bearer MOCK_ACCESS_u1'},
                       path_params={'uuidMatch': 'm1'})
    live = [copy.deepcopy(CHARACTER)]

    def _query(_pk):
        return copy.deepcopy(live)

    def _put(item):
        written.append(copy.deepcopy(item))
        if str(item.get('SK', '')).startswith('CHARACTER#'):
            live[:] = [item]

    with patch('match.handler.jwt_utils.verify_access_token',
               return_value={'uuid': 'u1', 'source': 'mock', 'role': 'PLAYER'}), \
            patch('match.handler.db_utils.put_item', side_effect=_put), \
            patch('match.handler.db_utils.query_by_pk', side_effect=_query), \
            patch('match.handler.db_utils.get_item', side_effect=_get):
        from match.handler import lambda_handler
        result = lambda_handler(event, {})
    assert result['statusCode'] == 200, result
    return json.loads(result['body']), written


def _character_locations(written):
    return [w.get('idLocation') for w in written if w.get('SK') == 'CHARACTER#c1']


def test_a_plain_forced_move_lands():
    body, written = _run(_story())

    assert body['movementApplied'] is True
    assert body['locationChanges'][0]['toLocationUuid'] == 'loc-2'
    assert _character_locations(written)[-1] == 2


def test_an_end_time_event_does_not_undo_the_move_it_applied():
    """The regression: the time-start pass re-read the roster and wrote the stale row back."""
    body, written = _run(_story(flag_end_time=1))

    assert body['timeEnded'] is True and body['movementApplied'] is True
    locations = _character_locations(written)
    assert locations, 'the character was never written'
    # Every write of the character, not only the last one: one row carrying the old
    # location anywhere in the sequence is the bug, whatever ends up on top.
    assert set(locations) == {2}


def test_the_end_time_pass_still_puts_everybody_to_sleep():
    """The re-read exists to force sleep; keeping the move must not cost that."""
    _, written = _run(_story(flag_end_time=1))

    slept = [w for w in written if w.get('SK') == 'CHARACTER#c1' and w.get('isSleeping') == 1]
    assert slept, 'nobody was put to sleep by the forced time end'


def test_a_forced_move_fires_the_destination_entry_event():
    body, written = _run(_story(entry_event=True))

    fired = body['automaticEvents']
    assert [f['trigger'] for f in fired] == ['FIRST_ENTRY']
    assert fired[0]['idLocation'] == 2
    assert fired[0]['eventUuid'] == 'evt-entry'
    assert fired[0]['card']['title'] == 'The gate closes'
    # The entry event's own effect landed on the character it welcomed.
    assert [w.get('exp') for w in written if w.get('SK') == 'CHARACTER#c1'][-1] == 3
    assert body['refreshRecommended'] is True


def test_the_automatic_events_key_is_always_there():
    """Empty is the normal case; the board must not tell it from an old backend."""
    body, _ = _run(_story())

    assert body['automaticEvents'] == []


def test_the_destination_is_marked_visited_by_the_arrival():
    _, written = _run(_story(entry_event=True))

    match_rows = [w for w in written if w.get('SK') == 'METADATA' and w.get('uuid') == 'm1']
    visited = {ls['idLocation']: ls.get('flagVisited') for ls in match_rows[-1]['locations']}
    assert visited[2] == 1


def test_reread_characters_keeps_the_rows_this_request_changed():
    from match import handler as h

    moved = {'uuid': 'c1', 'SK': 'CHARACTER#c1', 'idLocation': 2}
    with patch('match.handler.db_utils.query_by_pk',
               return_value=[{'uuid': 'c1', 'SK': 'CHARACTER#c1', 'idLocation': 1},
                             {'uuid': 'c2', 'SK': 'CHARACTER#c2', 'idLocation': 5}]):
        rows = h._reread_characters('m1', {'c1': moved})

    assert [r['idLocation'] for r in rows] == [2, 5]
    assert rows[0] is moved  # the same object, so a later write cannot lose what it holds


def test_reread_characters_tolerates_an_empty_touched_set():
    from match import handler as h

    with patch('match.handler.db_utils.query_by_pk',
               return_value=[{'uuid': 'c1', 'SK': 'CHARACTER#c1', 'idLocation': 1}]):
        assert [r['idLocation'] for r in h._reread_characters('m1', {})] == [1]
        assert [r['idLocation'] for r in h._reread_characters('m1', None)] == [1]
