"""Tests for the Step 21 character persistence adapter and story read additions.

Exercised against an in-memory SQLite database to cover the real ORM mappings.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.adapters.persistence.auth.models import Base
from app.adapters.persistence.match.character_persistence_adapter import CharacterPersistenceAdapter
from app.adapters.persistence.match.story_match_read_adapter import StoryMatchReadAdapter
from app.adapters.persistence.story.models import (
    CharacterTemplateEntity,
    ClassBonusEntity,
    ClassEntity,
    ItemEffectEntity,
    StoryDifficultyEntity,
    TraitEntity,
)
import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables


@pytest.fixture()
def session_factory():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    yield factory
    engine.dispose()


def _char_row(cid=1, match_id=500, user_id=7):
    return {
        "id": cid, "id_match": match_id, "id_user": user_id, "id_character_template": 90001,
        "dexterity": 19, "intelligence": 18, "constitution": 19, "energy": 127, "life": 137,
        "sad": 0, "id_location": 90001, "is_sleeping": 0, "is_coma": 0,
    }


def test_character_round_trip(session_factory):
    adapter = CharacterPersistenceAdapter(session_factory)
    assert adapter.count_characters_by_match_id(500) == 0
    saved = adapter.save_character(_char_row())
    assert saved["uuid"]
    assert saved["dexterity"] == 19

    assert adapter.count_characters_by_match_id(500) == 1
    chars = adapter.find_characters_by_match_id(500)
    assert len(chars) == 1
    found = adapter.find_character_by_match_and_uuid(500, saved["uuid"])
    assert found["id"] == 1
    by_user = adapter.find_character_by_match_and_user(500, 7)
    assert by_user["uuid"] == saved["uuid"]


def test_backpack_and_traits(session_factory):
    adapter = CharacterPersistenceAdapter(session_factory)
    adapter.save_character(_char_row())
    adapter.save_backpack({"id": 1, "id_match": 500, "id_character_match": 1,
                           "food": 4, "magic": 5, "coin": 6})
    bp = adapter.find_backpack(500, 1)
    assert bp == {"food": 4, "magic": 5, "coin": 6}

    adapter.save_traits([
        {"id": 1, "id_match": 500, "id_character_match": 1, "id_traits": 90001},
        {"id": 2, "id_match": 500, "id_character_match": 1, "id_traits": 90002},
    ])
    traits = adapter.find_traits(500, 1)
    assert sorted(t["id_traits"] for t in traits) == [90001, 90002]


def test_null_safety(session_factory):
    adapter = CharacterPersistenceAdapter(session_factory)
    assert adapter.find_character_by_match_and_user(None, 1) is None
    assert adapter.count_characters_by_match_id(None) == 0
    assert adapter.find_characters_by_match_id(None) == []
    assert adapter.find_character_by_match_and_uuid(500, "") is None
    assert adapter.find_backpack(None, 1) is None
    assert adapter.find_traits(500, None) == []
    assert adapter.find_backpack(500, 999) is None
    adapter.save_backpack(None)
    adapter.save_traits([])


def test_story_read_step21(session_factory):
    with session_factory() as session:
        session.add(CharacterTemplateEntity(
            id_tipo=90001, id_story=9001, uuid="tpl-uuid", life_max=12, energy_max=12, sad_max=8,
            dexterity_start=3, intelligence_start=3, constitution_start=3,
            id_class_permitted=None, id_class_prohibited=90002))
        session.add(ClassEntity(id=90001, id_story=9001, uuid="class-uuid",
                                weight_max=12, dexterity_base=3, intelligence_base=3, constitution_base=3))
        session.add(ClassBonusEntity(id=1, id_story=9001, uuid="b1", id_class=90001,
                                     statistic="life", value=3))
        session.add(TraitEntity(id=90001, id_story=9001, uuid="trait-1", life=2, energy=0,
                                dexterity=0, intelligence=0, constitution=1))
        session.add(StoryDifficultyEntity(id=90001, id_story=9001, uuid="diff", exp_cost=300,
                                          life=120, energy=110, sad=0, dexterity=12,
                                          intelligence=12, constitution=12, weight=12))
        session.commit()

    read = StoryMatchReadAdapter(session_factory)
    tpl = read.find_character_template_by_uuid(9001, "tpl-uuid")
    assert tpl["id_tipo"] == 90001 and tpl["life_max"] == 12 and tpl["id_class_prohibited"] == 90002
    assert read.find_character_template_by_uuid(9001, "missing") is None
    assert len(read.find_character_templates_by_story_id(9001)) == 1

    clazz = read.find_class_by_uuid(9001, "class-uuid")
    assert clazz["id"] == 90001 and clazz["dexterity_base"] == 3
    assert read.find_class_by_uuid(9001, "missing") is None

    trait = read.find_trait_by_uuid(9001, "trait-1")
    assert trait["life"] == 2 and trait["constitution"] == 1
    assert len(read.find_traits_by_story_id(9001)) == 1

    bonuses = read.find_class_bonuses_by_story_id(9001)
    assert bonuses == [{"id_class": 90001, "statistic": "life", "value": 3}]

    diff = read.find_difficulty_by_id(9001, 90001)
    assert diff["life"] == 120 and diff["dexterity"] == 12


def test_story_read_item_effects_grouped_by_item_step35(session_factory):
    """v0.35.0 — the rows the match /info items[] promise, grouped in one query."""
    with session_factory() as session:
        session.add(ItemEffectEntity(id=2, id_story=9001, uuid="e2", id_item=900,
                                     effect_code="SADNESS", effect_value=-1))
        session.add(ItemEffectEntity(id=1, id_story=9001, uuid="e1", id_item=900,
                                     effect_code="LIFE", effect_value=3))
        session.add(ItemEffectEntity(id=3, id_story=9001, uuid="e3", id_item=901,
                                     effect_code="ENERGY", effect_value=2))
        # An orphan row belongs to no item: skipped rather than grouped under None.
        session.add(ItemEffectEntity(id=4, id_story=9001, uuid="e4", id_item=None,
                                     effect_code="EXP", effect_value=1))
        session.commit()

    grouped = StoryMatchReadAdapter(session_factory).find_item_effects_by_item_id(9001)

    assert set(grouped) == {900, 901}
    # Id order, the order the usage applies them in.
    assert [r["effect_code"] for r in grouped[900]] == ["LIFE", "SADNESS"]
    assert grouped[900][0]["effect_value"] == 3
    assert StoryMatchReadAdapter(session_factory).find_item_effects_by_item_id(9999) == {}
