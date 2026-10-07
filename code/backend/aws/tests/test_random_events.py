"""Step 39 — unit tests for the random event picker (match/random_events.py)."""
import random
from decimal import Decimal

from match import random_events as re_


def _row(id, probability, id_event=None, key=None, value=None, op=None):
    return {'id': id, 'idEvent': id_event if id_event is not None else 50 + id,
            'probability': probability, 'conditionKey': key, 'conditionValue': value,
            'registryValueOperatorCondition': op}


def _story(rows, events=None):
    return {'id': 7, 'globalRandomEvents': rows,
            'events': events if events is not None else
            [{'id': r['idEvent'], 'type': 'AUTOMATIC'} for r in rows if r.get('idEvent')]}


def test_eligible_keeps_runnable_rows_with_their_condition_met():
    rows = [_row(1, 100), _row(2, 0), _row(3, 100, key='storm', value='yes', op='!='),
            _row(4, 100, key='storm', value='yes')]
    out = re_.eligible(_story(rows), [{'key': 'storm', 'stringValue': 'yes'}], set(), set())
    assert [r['id'] for r in out] == [1, 4]


def test_spent_once_is_out_spent_normal_stays():
    rows = [_row(1, 100, 11), _row(2, 100, 12)]
    events = [{'id': 11, 'type': 'ONCE'}, {'id': 12, 'type': 'NORMAL'}]
    out = re_.eligible(_story(rows, events), None, set(), {11, 12})
    assert [r['id'] for r in out] == [2]


def test_choices_dangling_and_missing_events_are_out():
    rows = [_row(1, 100, 11), _row(2, 100, 12), {'id': 3, 'probability': 100}]
    events = [{'id': 11, 'type': 'AUTOMATIC'}]
    assert re_.eligible(_story(rows, events), None, {11}, set()) == []


def test_blank_key_is_no_condition():
    assert len(re_.eligible(_story([_row(1, 100, key=' ')]), None, set(), set())) == 1


def test_order_probability_desc_then_id_asc():
    assert [r['id'] for r in re_.order([_row(3, 10), _row(1, 30), _row(2, 10)])] == [1, 2, 3]


def test_walk_ranges_and_past_the_total():
    ordered = [_row(1, 30), _row(2, 10)]
    assert re_.walk(ordered, 29)['id'] == 1
    assert re_.walk(ordered, 39)['id'] == 2
    assert re_.walk(ordered, 40) is None


def test_pick_rolls_over_max_100_total_with_the_seed():
    rows = [_row(1, 10), _row(2, 30)]
    for seed in range(50):
        roll = random.Random(seed).randrange(100)
        assert re_.pick(rows, seed) == re_.walk(re_.order(rows), roll)


def test_total_above_100_always_fires_and_decimal_seed_is_accepted():
    rows = [_row(1, Decimal(70)), _row(2, 60)]
    assert re_.total(rows) == 130
    assert all(re_.pick(rows, Decimal(seed)) is not None for seed in range(200))


def test_nothing_eligible_picks_nothing():
    assert re_.pick([], 1) is None


def test_seed_uses_rng_seed_or_story_plus_clock_plus_salt():
    assert re_.seed_for({'rngSeed': Decimal(42), 'currentClock': 3}, {'id': 7}) == 42 + 3 + re_.SEED_SALT
    assert re_.seed_for({'currentClock': 3}, {'id': 7}) == 7 + 3 + re_.SEED_SALT
