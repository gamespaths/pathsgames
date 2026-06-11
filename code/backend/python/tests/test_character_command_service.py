"""Tests for the Step 21 character join service."""
from unittest.mock import MagicMock

import pytest

from app.core.models.match.match_models import CharacterJoinError, JoinMatchCommand
from app.core.services.match.character_command_service import CharacterCommandService


STORY_ID = 9001
MATCH_ID = 500
USER_ID = 7


def _match(**over):
    base = {
        "id": MATCH_ID,
        "uuid": "match-uuid",
        "id_story": STORY_ID,
        "id_difficulty": 90001,
        "status": "CREATED",
        "id_user_creator": USER_ID,
        "character_template_uuid": "tpl-uuid",
        "class_uuid": "class-uuid",
        "trait_uuids": ["trait-1", "trait-2"],
    }
    base.update(over)
    return base


def _user(state=6):
    return {"id": USER_ID, "uuid": "user-uuid", "username": "g", "role": "PLAYER", "state": state}


def _template(**over):
    base = {
        "id_tipo": 90001, "uuid": "tpl-uuid",
        "life_max": 12, "energy_max": 12, "sad_max": 8,
        "dexterity_start": 3, "intelligence_start": 3, "constitution_start": 3,
        "id_class_permitted": None, "id_class_prohibited": None,
    }
    base.update(over)
    return base


def _class():
    return {"id": 90001, "uuid": "class-uuid",
            "dexterity_base": 3, "intelligence_base": 3, "constitution_base": 3, "weight_max": 12}


def _difficulty():
    return {"id": 90001, "uuid": "d", "life": 120, "energy": 110, "sad": 0,
            "dexterity": 12, "intelligence": 12, "constitution": 12}


def _bonuses():
    return [
        {"id_class": 90001, "statistic": "life", "value": 3},
        {"id_class": 90001, "statistic": "energy", "value": 3},
        {"id_class": 90001, "statistic": "exp", "value": 2},
    ]


def _trait(tid, life=0, energy=0, dex=0, intel=0, con=0):
    return {"id": tid, "uuid": f"trait-{tid}", "life": life, "energy": energy,
            "dexterity": dex, "intelligence": intel, "constitution": con}


@pytest.fixture()
def env():
    story = MagicMock()
    match_p = MagicMock()
    user_a = MagicMock()
    char_p = MagicMock()
    service = CharacterCommandService(story, match_p, user_a, char_p)
    return service, story, match_p, user_a, char_p


def _wire_full(story, match_p, user_a, char_p):
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_p.find_character_by_match_and_user.return_value = None
    char_p.count_characters_by_match_id.return_value = 0
    char_p.save_character.side_effect = lambda row: {**row, "uuid": "char-uuid"}
    story.find_story_by_id.return_value = {"id": STORY_ID, "id_location_start": 90001}
    story.find_character_template_by_uuid.return_value = _template()
    story.find_class_by_uuid.return_value = _class()
    story.find_class_bonuses_by_story_id.return_value = _bonuses()
    story.find_difficulty_by_id.return_value = _difficulty()
    story.find_trait_by_uuid.side_effect = lambda sid, u: {
        "trait-1": _trait(90001, life=2, con=1),
        "trait-2": _trait(90002, energy=2, dex=1),
    }.get(u)
    story.find_locations_by_story_id.return_value = [{"id": 90001, "uuid": "loc-start", "counter_start": 0}]


def _cmd(**over):
    base = dict(match_uuid="match-uuid", user_uuid="user-uuid",
               character_template_uuid="tpl-uuid", class_uuid="class-uuid",
               trait_uuids=["trait-1", "trait-2"])
    base.update(over)
    return JoinMatchCommand(**base)


# ─── validation ─────────────────────────────────────────────────────────────

def test_none_command(env):
    service = env[0]
    with pytest.raises(CharacterJoinError) as e:
        service.join(None)
    assert e.value.code == CharacterJoinError.INVALID_INPUT


def test_blank_match_uuid(env):
    service = env[0]
    with pytest.raises(CharacterJoinError) as e:
        service.join(JoinMatchCommand(match_uuid="", user_uuid="u"))
    assert e.value.code == CharacterJoinError.INVALID_INPUT


def test_match_not_found(env):
    service, story, match_p, *_ = env
    match_p.find_match_by_uuid.return_value = None
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.MATCH_NOT_FOUND


def test_terminal_match(env):
    service, story, match_p, *_ = env
    match_p.find_match_by_uuid.return_value = _match(status="ENDED")
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.MATCH_NOT_JOINABLE


def test_user_not_found(env):
    service, story, match_p, user_a, char_p = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = None
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.USER_NOT_FOUND


def test_banned_user(env):
    service, story, match_p, user_a, char_p = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user(state=4)
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.USER_BANNED


def test_already_joined(env):
    service, story, match_p, user_a, char_p = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_p.find_character_by_match_and_user.return_value = {"id": 1}
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.ALREADY_JOINED


def test_story_missing(env):
    service, story, match_p, user_a, char_p = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_p.find_character_by_match_and_user.return_value = None
    story.find_story_by_id.return_value = None
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.MATCH_NOT_FOUND


def test_no_template(env):
    service, story, match_p, user_a, char_p = env
    match_p.find_match_by_uuid.return_value = _match(character_template_uuid=None)
    user_a.find_by_uuid.return_value = _user()
    char_p.find_character_by_match_and_user.return_value = None
    story.find_story_by_id.return_value = {"id": STORY_ID, "id_location_start": 1}
    with pytest.raises(CharacterJoinError) as e:
        service.join(JoinMatchCommand(match_uuid="match-uuid", user_uuid="user-uuid"))
    assert e.value.code == CharacterJoinError.INVALID_INPUT


def test_template_not_found(env):
    service, story, match_p, user_a, char_p = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_p.find_character_by_match_and_user.return_value = None
    story.find_story_by_id.return_value = {"id": STORY_ID, "id_location_start": 1}
    story.find_character_template_by_uuid.return_value = None
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.TEMPLATE_NOT_FOUND


def test_class_not_found(env):
    service, story, match_p, user_a, char_p = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_p.find_character_by_match_and_user.return_value = None
    story.find_story_by_id.return_value = {"id": STORY_ID, "id_location_start": 1}
    story.find_character_template_by_uuid.return_value = _template()
    story.find_class_by_uuid.return_value = None
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.CLASS_NOT_FOUND


def test_class_not_permitted(env):
    service, story, match_p, user_a, char_p = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_p.find_character_by_match_and_user.return_value = None
    story.find_story_by_id.return_value = {"id": STORY_ID, "id_location_start": 1}
    story.find_character_template_by_uuid.return_value = _template(id_class_permitted=99999)
    story.find_class_by_uuid.return_value = _class()
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.CLASS_NOT_COMPATIBLE


def test_class_prohibited(env):
    service, story, match_p, user_a, char_p = env
    match_p.find_match_by_uuid.return_value = _match()
    user_a.find_by_uuid.return_value = _user()
    char_p.find_character_by_match_and_user.return_value = None
    story.find_story_by_id.return_value = {"id": STORY_ID, "id_location_start": 1}
    story.find_character_template_by_uuid.return_value = _template(id_class_prohibited=90001)
    story.find_class_by_uuid.return_value = _class()
    with pytest.raises(CharacterJoinError) as e:
        service.join(_cmd())
    assert e.value.code == CharacterJoinError.CLASS_NOT_COMPATIBLE


# ─── happy paths ─────────────────────────────────────────────────────────────

def test_computes_final_stats(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)

    info = service.join(_cmd())

    assert info.dexterity == 19      # 3+3+12+1
    assert info.intelligence == 18   # 3+3+12+0
    assert info.constitution == 19   # 3+3+12+1
    assert info.life == 137          # 12+120+2+3(bonus)
    assert info.energy == 127        # 12+110+2+3(bonus)
    assert info.sad == 0
    assert info.id_location == 90001
    assert info.location_uuid == "loc-start"
    assert info.user_uuid == "user-uuid"
    assert info.character_template_uuid == "tpl-uuid"
    assert info.class_uuid == "class-uuid"
    assert info.trait_uuids == ["trait-1", "trait-2"]
    assert info.food == 0


def test_persists_instance_backpack_traits(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)

    service.join(_cmd())

    saved = char_p.save_character.call_args[0][0]
    assert saved["id"] == 1
    assert saved["id_user"] == USER_ID
    assert saved["id_character_template"] == 90001
    backpack = char_p.save_backpack.call_args[0][0]
    assert backpack["food"] == 0 and backpack["id_character_match"] == 1
    trait_rows = char_p.save_traits.call_args[0][0]
    assert [r["id_traits"] for r in trait_rows] == [90001, 90002]
    assert [r["id"] for r in trait_rows] == [1, 2]


def test_next_id_from_count(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    char_p.count_characters_by_match_id.return_value = 3

    service.join(_cmd())

    assert char_p.save_character.call_args[0][0]["id"] == 4


def test_fallback_to_match_loadout(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)

    info = service.join(JoinMatchCommand(match_uuid="match-uuid", user_uuid="user-uuid"))

    assert info.character_template_uuid == "tpl-uuid"
    assert info.class_uuid == "class-uuid"
    assert info.dexterity == 19


def test_no_class(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    match_p.find_match_by_uuid.return_value = _match(class_uuid=None)

    info = service.join(JoinMatchCommand(match_uuid="match-uuid", user_uuid="user-uuid",
                                         character_template_uuid="tpl-uuid",
                                         trait_uuids=["trait-1", "trait-2"]))

    assert info.dexterity == 16   # 3+0+12+1
    assert info.class_uuid is None
    story.find_class_by_uuid.assert_not_called()


def test_no_difficulty(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    story.find_difficulty_by_id.return_value = None

    info = service.join(_cmd())

    assert info.dexterity == 7   # 3+3+0+1


def test_unknown_trait_not_found(env):
    """Step 23 — unknown trait uuids are rejected (was silently skipped)."""
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    story.find_trait_by_uuid.side_effect = lambda sid, u: (
        _trait(90001, life=2, con=1) if u == "trait-1" else None
    )

    with pytest.raises(CharacterJoinError) as exc:
        service.join(_cmd())
    assert exc.value.code == CharacterJoinError.TRAIT_NOT_FOUND
    char_p.save_character.assert_not_called()


# ─── Step 23: trait selection validation ────────────────────────────────────


def _cost_trait(tid, cost_positive=0, cost_negative=0, permitted=None, prohibited=None):
    return {**_trait(tid), "cost_positive": cost_positive, "cost_negative": cost_negative,
            "id_class_permitted": permitted, "id_class_prohibited": prohibited}


def test_duplicate_trait(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)

    with pytest.raises(CharacterJoinError) as exc:
        service.join(_cmd(trait_uuids=["trait-1", "trait-1"]))
    assert exc.value.code == CharacterJoinError.TRAIT_DUPLICATED


def test_trait_permitted_other_class(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    story.find_trait_by_uuid.side_effect = None
    story.find_trait_by_uuid.return_value = _cost_trait(90001, permitted=99999)

    with pytest.raises(CharacterJoinError) as exc:
        service.join(_cmd(trait_uuids=["trait-1"]))
    assert exc.value.code == CharacterJoinError.TRAIT_NOT_COMPATIBLE


def test_trait_prohibited_for_class(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    story.find_trait_by_uuid.side_effect = None
    story.find_trait_by_uuid.return_value = _cost_trait(90001, prohibited=90001)

    with pytest.raises(CharacterJoinError) as exc:
        service.join(_cmd(trait_uuids=["trait-1"]))
    assert exc.value.code == CharacterJoinError.TRAIT_NOT_COMPATIBLE


def test_permitted_trait_without_class(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    match_p.find_match_by_uuid.return_value = _match(class_uuid=None)
    story.find_trait_by_uuid.side_effect = None
    story.find_trait_by_uuid.return_value = _cost_trait(90001, permitted=90001)

    with pytest.raises(CharacterJoinError) as exc:
        service.join(_cmd(class_uuid=None, trait_uuids=["trait-1"]))
    assert exc.value.code == CharacterJoinError.TRAIT_NOT_COMPATIBLE


def test_positive_budget_exceeded(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    story.find_difficulty_by_id.return_value = {**_difficulty(), "trait_cost_positive_budget": 1}
    story.find_trait_by_uuid.side_effect = lambda sid, u: {
        "trait-1": _cost_trait(90001, cost_positive=1),
        "trait-2": _cost_trait(90002, cost_positive=1),
    }.get(u)

    with pytest.raises(CharacterJoinError) as exc:
        service.join(_cmd())
    assert exc.value.code == CharacterJoinError.TRAIT_COST_EXCEEDED


def test_negative_budget_exceeded(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    story.find_difficulty_by_id.return_value = {**_difficulty(), "trait_cost_negative_budget": 3}
    story.find_trait_by_uuid.side_effect = lambda sid, u: {
        "trait-1": _cost_trait(90001, cost_negative=2),
        "trait-2": _cost_trait(90002, cost_negative=2),
    }.get(u)

    with pytest.raises(CharacterJoinError) as exc:
        service.join(_cmd())
    assert exc.value.code == CharacterJoinError.TRAIT_COST_EXCEEDED


def test_exact_budget_ok(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    story.find_difficulty_by_id.return_value = {
        **_difficulty(), "trait_cost_positive_budget": 2, "trait_cost_negative_budget": 2}
    story.find_trait_by_uuid.side_effect = lambda sid, u: {
        "trait-1": _cost_trait(90001, cost_positive=1, cost_negative=1),
        "trait-2": _cost_trait(90002, cost_positive=1, cost_negative=1),
    }.get(u)

    info = service.join(_cmd())
    assert info.trait_uuids == ["trait-1", "trait-2"]


def test_null_budgets_unlimited(env):
    service, story, match_p, user_a, char_p = env
    _wire_full(story, match_p, user_a, char_p)
    story.find_trait_by_uuid.side_effect = lambda sid, u: {
        "trait-1": _cost_trait(90001, cost_positive=50, cost_negative=50),
        "trait-2": _cost_trait(90002, cost_positive=50, cost_negative=50),
    }.get(u)

    info = service.join(_cmd())
    assert info.trait_uuids == ["trait-1", "trait-2"]
