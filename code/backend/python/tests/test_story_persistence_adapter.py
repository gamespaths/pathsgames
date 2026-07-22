import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import Text
from app.adapters.persistence.story.models import Base, StoryEntity, TextEntity, CardEntity, CreatorEntity
from app.adapters.persistence.story.story_persistence_adapter import StoryPersistenceAdapter

@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)

@pytest.fixture
def adapter(session_factory):
    return StoryPersistenceAdapter(session_factory)

def test_save_story(adapter, session_factory):
    story_data = {
        "uuid": "test-uuid",
        "author": "author",
        "category": "cat",
        "group": "group",
        "idTextTitle": 1,
        "idTextDescription": 2
    }
    story_id = adapter.save_story(story_data)
    assert story_id > 0
    
    assert adapter.find_story_id_by_uuid("test-uuid") == story_id
    assert adapter.find_story_id_by_uuid("missing") is None

def test_save_texts(adapter, session_factory):
    story_id = adapter.save_story({"uuid": "test-uuid-2"})
    texts = [
        {"idText": 1, "lang": "en", "shortText": "Short", "longText": "Long"}
    ]
    adapter.save_texts(story_id, texts)
    
    with session_factory() as session:
        text_ent = session.query(TextEntity).filter_by(id_story=story_id).first()
        assert text_ent is not None
        assert text_ent.short_text == "Short"

def test_save_texts_reused_id_across_languages(adapter, session_factory):
    # The import JSON reuses the same surrogate "id" across language variants
    # (id_text + lang is the real identity). All rows must persist without a
    # PK collision on (id, id_story).
    story_id = adapter.save_story({"uuid": "test-uuid-texts-langs"})
    texts = [
        {"id": 25, "idText": 25, "lang": "en", "shortText": "Cas Holmes"},
        {"id": 25, "idText": 25, "lang": "it", "shortText": "Cas Holmes"},
        {"id": 26, "idText": 26, "lang": "en", "shortText": "Other"},
    ]
    adapter.save_texts(story_id, texts)

    with session_factory() as session:
        rows = session.query(TextEntity).filter_by(id_story=story_id).all()
        assert len(rows) == 3
        ids = [r.id for r in rows]
        assert len(set(ids)) == 3  # surrogate ids are unique
        langs = {(r.id_text, r.lang) for r in rows}
        assert (25, "en") in langs and (25, "it") in langs


def test_save_traits_with_empty_string_in_integer_fields(adapter, session_factory):
    # The import JSON carries "" in numeric fields (e.g. weight, costPositive,
    # idClassPermitted). PostgreSQL rejects '' for integer columns; the adapter
    # must coerce empty/non-numeric strings to None (mirrors Java getInteger).
    from app.adapters.persistence.story.models import TraitEntity
    story_id = adapter.save_story({"uuid": "test-uuid-traits-empty"})
    traits = [
        {"id": 1, "idCard": 37, "weight": "", "costPositive": 0, "dexterity": 1},
        {"id": 3, "idCard": 39, "costPositive": "", "idClassPermitted": "", "energy": 1},
    ]
    adapter.save_traits(story_id, traits)

    with session_factory() as session:
        rows = session.query(TraitEntity).filter_by(id_story=story_id).order_by(TraitEntity.id).all()
        assert len(rows) == 2
        # "" is coerced to None, never stored as the string ""; columns with a
        # default fall back to it (weight/cost_positive default=0), columns
        # without a default stay None (id_class_permitted).
        assert rows[0].weight == 0
        assert rows[1].cost_positive == 0
        assert rows[1].id_class_permitted is None
        assert rows[1].energy == 1


def test_unbounded_text_columns_match_java_schema():
    # url_image (base64 SVG data URIs) and link_copyright can far exceed 500 chars.
    # Java declares these as TEXT; the Python model must too, or PostgreSQL raises
    # StringDataRightTruncation on import (SQLite silently ignores VARCHAR length).
    assert isinstance(CardEntity.__table__.c.url_image.type, Text)
    assert isinstance(CardEntity.__table__.c.link_copyright.type, Text)
    assert isinstance(CreatorEntity.__table__.c.url_image.type, Text)
    assert isinstance(TextEntity.__table__.c.link_copyright.type, Text)
    assert isinstance(StoryEntity.__table__.c.link_copyright.type, Text)


def test_delete_story_by_id(adapter, session_factory):
    story_id = adapter.save_story({"uuid": "test-uuid-3"})
    adapter.save_texts(story_id, [{"idText": 1, "lang": "en", "shortText": "Short", "longText": "Long"}])
    
    adapter.delete_story_by_id(story_id)
    
    with session_factory() as session:
        assert session.query(StoryEntity).filter_by(id=story_id).first() is None
        assert session.query(TextEntity).filter_by(id_story=story_id).first() is None

def test_update_story_by_id(adapter, session_factory):
    story_id = adapter.save_story({"uuid": "test-uuid-4", "author": "old"})
    adapter.update_story_by_id(story_id, {"author": "new_author"})
    
    with session_factory() as session:
        story = session.query(StoryEntity).filter_by(id=story_id).first()
        assert story.author == "new_author"

def test_save_entity_and_update_entity(adapter, session_factory):
    story_id = adapter.save_story({"uuid": "test-uuid-5"})
    
    # Insert generic entity
    adapter.save_entity(story_id, "list_texts", {
        "idText": 2, "lang": "it", "shortText": "Corto"
    })
    
    with session_factory() as session:
        text_ent = session.query(TextEntity).filter_by(id_story=story_id, id_text=2).first()
        assert text_ent is not None
        assert text_ent.short_text == "Corto"
        text_uuid = text_ent.uuid
        
    adapter.update_entity(story_id, "list_texts", text_uuid, {"shortText": "Modificato"})
    
    with session_factory() as session:
        text_ent = session.query(TextEntity).filter_by(uuid=text_uuid).first()
        assert text_ent.short_text == "Modificato"
        
    adapter.delete_entity_by_uuid("list_texts", text_uuid)
    
    with session_factory() as session:
        text_ent = session.query(TextEntity).filter_by(uuid=text_uuid).first()
        assert text_ent is None

def test_various_saves(adapter):
    story_id = adapter.save_story({"uuid": "test-uuid-6"})
    
    adapter.save_difficulties(story_id, [{"idTextDescription": 1, "expCost": 10}])
    adapter.save_locations(story_id, [{"idTextName": 1, "neighbors": [
        {"idLocationTo": 2, "direction": "N", "idCard": 7, "idCardBack": 9}]}])
    # Step 0.28.2 — the neighbor's forward + return cards persist.
    from app.adapters.persistence.story.models import LocationNeighborEntity
    with adapter.session_factory() as session:
        nb = session.query(LocationNeighborEntity).filter_by(id_story=story_id).first()
        assert nb.id_card == 7
        assert nb.id_card_back == 9
    adapter.save_events(story_id, [{"idTextName": 1, "effects": [{"effectType": "HP", "effectValue": 10}]}])
    adapter.save_items(story_id, [{"idTextName": 1, "effects": [{"effectType": "HP", "effectValue": 10}]}])
    adapter.save_classes(story_id, [{"idTextName": 1, "bonuses": [{"bonusType": "STR", "bonusValue": 10}]}])
    # Step 31 — the canonical TOP-LEVEL choice shape (keyed by idChoices), Java field names.
    adapter.save_choices(story_id, [{
        "id": 1, "idEvent": 1, "idTextName": 1, "otherwiseFlag": 1,
        "logicOperator": "OR", "limitDex": 3, "idTextNarrative": 9,
    }])
    adapter.save_choice_conditions(story_id, [
        {"id": 1, "idChoices": 1, "type": "statistics", "key": "int", "value": "3", "operator": ">"},
        {"id": 2, "idChoices": 1, "type": "KEYS", "key": "gate", "value": "OPEN"},
    ])
    adapter.save_choice_effects(story_id, [
        {"id": 1, "idChoices": 1, "statistics": "energy", "value": 2}])
    from app.adapters.persistence.story.models import (
        ChoiceConditionEntity, ChoiceEffectEntity, ChoiceEntity)
    with adapter.session_factory() as session:
        ch = session.query(ChoiceEntity).filter_by(id_story=story_id, id=1).first()
        assert ch.is_otherwise == 1 and ch.logic_operator == "OR"
        assert ch.limit_dex == 3 and ch.id_text_narrative == 9
        conds = session.query(ChoiceConditionEntity).filter_by(
            id_story=story_id).order_by(ChoiceConditionEntity.id).all()
        assert [c.condition_type for c in conds] == ["statistics", "KEYS"]
        assert conds[0].condition_operator == ">"
        assert conds[1].condition_operator == "="  # the comparator default, not AND
        eff = session.query(ChoiceEffectEntity).filter_by(id_story=story_id).first()
        assert eff.id_choice == 1 and eff.effect_type == "energy" and eff.effect_value == 2
    adapter.save_cards(story_id, [{"cardType": "test"}])
    adapter.save_keys(story_id, [{"keyName": "key", "keyValue": "val"}])
    adapter.save_traits(story_id, [{"idTextName": 1}])
    adapter.save_character_templates(story_id, [{"idTextName": 1}])
    adapter.save_weather_rules(story_id, [{"idTextName": 1}])
    adapter.save_global_random_events(story_id, [{"idEvent": 1}])
    adapter.save_missions(story_id, [{"idTextName": 1, "steps": [{"conditionKey": "key"}]}])
    adapter.save_creators(story_id, [{"creatorName": "test"}])
