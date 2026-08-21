"""Steps 34 & 35 — the pure inventory engine for the AWS backend.

Mirrors InventoryServiceTest.java / test_inventory_service.py, minus the persistence:
here the items are an embedded list on the character item, not a table.
"""
import pytest

from match import inventory


def _char(items=None, **over):
    base = {'uuid': 'c1', 'isSleeping': 0, 'isComa': 0, 'idClass': 7,
            'items': items if items is not None else []}
    base.update(over)
    return base


def _story(items=None, item_effects=None):
    return {'items': items or [], 'itemEffects': item_effects or []}


def _item(iid=900, weight=3, consumable=1, **over):
    base = {'id': iid, 'uuid': f'item-{iid}', 'weight': weight,
            'isConsumabile': consumable, 'idCard': None, 'idTextName': 400}
    base.update(over)
    return base


def _row(uuid='row-1', id_item=900, amount=1):
    return {'uuid': uuid, 'idItem': id_item, 'amount': amount, 'state': 'ACTIVE'}


# ── effect codes ────────────────────────────────────────────────────────────

@pytest.mark.parametrize('code,expected', [
    ('LIFE', 'life'), ('ENERGY', 'energy'), ('EXP', 'exp'), ('DEX', 'dex'),
    ('SADNESS', 'sad'), ('sadness', 'sad'), ('sad', 'sad'), ('COINS', 'coin'),
    ('  Energy  ', 'energy'), ('HEALTH', 'health'),
])
def test_normalize_effect_code(code, expected):
    assert inventory.normalize_effect_code(code) == expected


def test_normalize_effect_code_null_and_blank():
    assert inventory.normalize_effect_code(None) is None
    assert inventory.normalize_effect_code('   ') is None


# ── carried weight ──────────────────────────────────────────────────────────

def test_carried_weight_sums_weight_times_amount():
    story = _story([_item(900, 3), _item(901, 5)])
    char = _char([_row('a', 900, 2), _row('b', 901, 1)])

    assert inventory.carried_weight(char, story) == 11


def test_carried_weight_null_amount_counts_as_one_unknown_item_weighs_nothing():
    story = _story([_item(900, 7)])
    char = _char([_row('a', 900, None), _row('b', 999, 3)])

    assert inventory.carried_weight(char, story) == 7


def test_carried_weight_of_an_empty_inventory():
    assert inventory.carried_weight(_char(), _story()) == 0
    assert inventory.carried_weight({}, {}) == 0


def test_unit_amount_defaults():
    assert inventory.unit_amount(None) == 1
    assert inventory.unit_amount(4) == 4
    assert inventory.unit_amount(0) == 0


# ── row lookup ──────────────────────────────────────────────────────────────

def test_find_own_row_matches_the_row_uuid_not_the_item_uuid():
    char = _char([_row('row-1', 900), _row('row-2', 900)])

    assert inventory.find_own_row(char, 'row-2')['uuid'] == 'row-2'
    assert inventory.find_own_row(char, 'item-900') is None
    assert inventory.find_own_row(char, 'nope') is None
    assert inventory.find_own_row(char, '  ') is None
    assert inventory.find_own_row(char, None) is None
    assert inventory.find_own_row({}, 'row-1') is None


def test_remove_row_discards_the_whole_row():
    row = _row('row-1', 900, 5)
    char = _char([row, _row('row-2', 901)])

    inventory.remove_row(char, row)

    assert [r['uuid'] for r in char['items']] == ['row-2']


def test_remove_row_is_a_no_op_for_a_row_that_is_not_there():
    char = _char([_row('row-1', 900)])
    inventory.remove_row(char, _row('other', 901))
    assert len(char['items']) == 1


# ── the refusal ─────────────────────────────────────────────────────────────

def test_check_passes_a_usable_item():
    assert inventory.check({'status': 'RUNNING'}, _char(), _item(),
                           require_consumable=True) is None


def test_check_refuses_a_match_that_is_not_running():
    assert inventory.check({'status': 'PAUSED'}, _char(), _item(),
                           require_consumable=True) == 'MATCH_NOT_RUNNING'


def test_coma_is_checked_before_sleeping():
    char = _char(isSleeping=1, isComa=1)
    assert inventory.check({'status': 'RUNNING'}, char, _item(),
                           require_consumable=True) == 'COMA'


def test_sleeping():
    char = _char(isSleeping=1)
    assert inventory.check({'status': 'RUNNING'}, char, _item(),
                           require_consumable=True) == 'SLEEPING'


def test_a_missing_story_item_is_a_missing_item():
    assert inventory.check({'status': 'RUNNING'}, _char(), None,
                           require_consumable=True) == 'ITEM_NOT_FOUND'


def test_only_a_consumable_can_be_used():
    assert inventory.check({'status': 'RUNNING'}, _char(), _item(consumable=0),
                           require_consumable=True) == 'ITEM_NOT_CONSUMABLE'


def test_dropping_applies_neither_the_consumable_nor_the_class_gate():
    """A non-consumable item must be droppable — that is the point of carrying one."""
    item = _item(consumable=0, idClassPermitted=8)
    assert inventory.check({'status': 'RUNNING'}, _char(), item,
                           require_consumable=False) is None


def test_class_not_permitted():
    item = _item(idClassPermitted=8)
    assert inventory.check({'status': 'RUNNING'}, _char(), item,
                           require_consumable=True) == 'ITEM_CLASS_NOT_PERMITTED'


def test_a_classless_character_cannot_satisfy_a_permitted_gate():
    item = _item(idClassPermitted=8)
    assert inventory.check({'status': 'RUNNING'}, _char(idClass=None), item,
                           require_consumable=True) == 'ITEM_CLASS_NOT_PERMITTED'


def test_class_prohibited():
    item = _item(idClassProhibited=7)
    assert inventory.check({'status': 'RUNNING'}, _char(), item,
                           require_consumable=True) == 'ITEM_CLASS_PROHIBITED'


def test_the_matching_permitted_class_passes():
    assert inventory.check({'status': 'RUNNING'}, _char(), _item(idClassPermitted=7),
                           require_consumable=True) is None


def test_zero_means_no_restriction():
    item = _item(idClassPermitted=0, idClassProhibited=0)
    assert inventory.check({'status': 'RUNNING'}, _char(), item,
                           require_consumable=True) is None


def test_a_classless_character_is_untouched_by_a_prohibited_gate():
    item = _item(idClassProhibited=7)
    assert inventory.check({'status': 'RUNNING'}, _char(idClass=None), item,
                           require_consumable=True) is None


# ── effect mapping ──────────────────────────────────────────────────────────

def test_standalone_effects_normalises_and_keeps_the_trait_csvs():
    story = _story([_item()], [
        {'id': 1, 'uuid': 'e1', 'idItem': 900, 'effectCode': 'SADNESS', 'effectValue': -2},
        {'id': 2, 'uuid': 'e2', 'idItem': 900, 'effectCode': 'LIFE', 'effectValue': 3,
         'traitsToAdd': '7,8', 'traitsToRemove': '9', 'idCard': 77},
        {'id': 3, 'uuid': 'e3', 'idItem': 901, 'effectCode': 'LIFE', 'effectValue': 1},
    ])

    effects = inventory.standalone_effects(story, _item())

    assert len(effects) == 2, "another item's effects must not leak in"
    assert effects[0]['statistics'] == 'sad'
    assert effects[0]['value'] == -2
    assert effects[1]['statistics'] == 'life'
    assert effects[1]['traitsToAdd'] == '7,8'
    assert effects[1]['traitsToRemove'] == '9'
    assert effects[1]['idCard'] == 77
    assert effects[1]['uuid'] == 'e2'


def test_standalone_effects_of_an_item_with_none():
    assert inventory.standalone_effects(_story([_item()]), _item()) == []


# ── the usage log ───────────────────────────────────────────────────────────

def test_log_item_usage_appends_to_the_match_item():
    """There is no log table here: logs are embedded lists on the match, like eventLog."""
    match = {}

    inventory.log_item_usage(match, _char(), 900, 4, [{'statistic': 'life'}])

    assert match['itemUsageLog'] == [{
        'characterUuid': 'c1', 'idItem': 900, 'counter': 1, 'clock': 4,
        'effects': [{'statistic': 'life'}],
    }]


def test_log_item_usage_appends_rather_than_replaces():
    match = {'itemUsageLog': [{'idItem': 1}]}
    inventory.log_item_usage(match, _char(), 900, 4, [])
    assert len(match['itemUsageLog']) == 2


def test_items_by_id_skips_rows_without_an_id():
    story = _story([_item(900), {'uuid': 'no-id', 'weight': 9}])
    assert list(inventory.items_by_id(story)) == [900]


def test_a_non_numeric_amount_or_weight_is_read_as_zero_not_a_crash():
    """Authored noise must not take the whole request down."""
    story = _story([_item(900, weight='heavy')])
    char = _char([_row('a', 900, 'many')])

    assert inventory.carried_weight(char, story) == 0
    assert inventory.unit_amount('many') == 0


def test_a_dangling_row_is_droppable_but_not_usable():
    """A re-import can strand a row whose story item is gone.

    Using it is impossible — the effects, the consumable flag and the class gates all live
    on the story item. Dropping it must still work, or the row would weigh the character
    down forever with no way to put it back. Java and Python behave the same way.
    """
    match = {'status': 'RUNNING'}
    assert inventory.check(match, _char(), None, require_consumable=False) is None
    assert inventory.check(match, _char(), None, require_consumable=True) == 'ITEM_NOT_FOUND'


def test_a_dangling_row_still_loses_to_the_state_gates():
    """Order matters: a sleeping character cannot drop either."""
    match = {'status': 'RUNNING'}
    assert inventory.check(match, _char(isSleeping=1), None,
                           require_consumable=False) == 'SLEEPING'
    assert inventory.check({'status': 'PAUSED'}, _char(), None,
                           require_consumable=False) == 'MATCH_NOT_RUNNING'
