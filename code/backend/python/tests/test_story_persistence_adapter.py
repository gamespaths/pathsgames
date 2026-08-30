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


def test_save_event_effects_with_empty_string_in_integer_fields(adapter, session_factory):
    # v0.35.8 — the nested/child rows were built without going through the type
    # coercion, so an authored "" (tutorial_story.json: eventEffects idWeather)
    # reached PostgreSQL as '' and killed the whole import with
    # "invalid input syntax for type integer".
    from app.adapters.persistence.story.models import EventEffectEntity
    story_id = adapter.save_story({"uuid": "test-uuid-effects-empty"})
    adapter.save_event_effects(story_id, [
        {"id": 5, "idEvent": 7, "idWeather": "", "idLocation": 4,
         "statistics": "LIFE", "value": 1, "target": "ALL"},
    ])

    with session_factory() as session:
        row = session.query(EventEffectEntity).filter_by(id_story=story_id, id=5).one()
        assert row.id_weather is None
        assert row.id_location == 4
        assert row.value == 1


def test_save_choice_effects_and_conditions_with_empty_strings(adapter, session_factory):
    # Same coercion, on the other two child tables of the shared JSON contract.
    from app.adapters.persistence.story.models import (
        ChoiceEffectEntity, ChoiceConditionEntity)
    story_id = adapter.save_story({"uuid": "test-uuid-choices-empty"})
    adapter.save_choice_effects(story_id, [
        {"id": 1, "idChoices": 2, "idWeather": "", "idLocation": "", "value": 3},
    ])
    adapter.save_choice_conditions(story_id, [
        {"id": 1, "idChoices": 2, "type": "CLASS", "value": "5"},
    ])

    with session_factory() as session:
        effect = session.query(ChoiceEffectEntity).filter_by(id_story=story_id, id=1).one()
        assert effect.id_weather is None
        assert effect.id_location is None
        assert effect.value == 3
        condition = session.query(ChoiceConditionEntity).filter_by(id_story=story_id, id=1).one()
        assert condition.condition_value == "5"


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

def test_admin_create_of_a_choice_condition_stores_every_field(adapter, session_factory):
    """The admin sends short/plural keys (idChoices, type, key, value, operator) that do
    NOT match the DB columns' own camelCase (idChoice, conditionType, ...). Without the
    alias map the generic save_entity stored an orphaned, empty row — under OR, with no
    effective conditions, that would open the option to everyone. This pins the fix.
    """
    from app.adapters.persistence.story.models import ChoiceConditionEntity
    story_id = adapter.save_story({"uuid": "test-choice-cond"})

    adapter.save_entity(story_id, "list_choices_conditions", {
        "uuid": "cc-uuid-1", "idChoices": 42, "type": "CLASS",
        "value": "1", "operator": "=",
    })

    with session_factory() as session:
        row = session.query(ChoiceConditionEntity).filter_by(
            id_story=story_id, uuid="cc-uuid-1").first()
        assert row is not None, "the row must exist (no uuid crash)"
        assert row.id_choice == 42, "the choice link must be stored, not orphaned"
        assert row.condition_type == "CLASS"
        assert row.condition_value == "1"
        assert row.condition_operator == "="

    # Update by uuid maps the short keys too.
    adapter.update_entity(story_id, "list_choices_conditions", "cc-uuid-1",
                          {"value": "2", "operator": "!="})
    with session_factory() as session:
        row = session.query(ChoiceConditionEntity).filter_by(uuid="cc-uuid-1").first()
        assert row.condition_value == "2" and row.condition_operator == "!="


def test_admin_create_of_a_choice_effect_links_the_choice(adapter, session_factory):
    """The effect fields already match, but id_choice used the plural idChoices too."""
    from app.adapters.persistence.story.models import ChoiceEffectEntity
    story_id = adapter.save_story({"uuid": "test-choice-eff"})

    adapter.save_entity(story_id, "list_choices_effects", {
        "uuid": "ce-uuid-1", "idChoices": 7, "statistics": "life", "value": -3,
        "idEvent": 99,
    })

    with session_factory() as session:
        row = session.query(ChoiceEffectEntity).filter_by(
            id_story=story_id, uuid="ce-uuid-1").first()
        assert row is not None
        assert row.id_choice == 7, "the effect must attach to its choice"
        assert row.statistics == "life" and row.value == -3
        assert row.id_event == 99


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
    # v0.34.0 — the legacy nested shape still imports, mapped onto effect_code.
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
        {"id": 1, "idChoices": 1, "statistics": "energy", "value": 2, "idCard": 4,
         "flagGroup": 1, "key": "gate", "valueToAdd": "OPEN",
         "idEvent": 7, "idLocation": 8, "idWeather": 9,
         "idItemTarget": 10, "itemAction": "ADD"}])
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
        # Step 32 realigned the model onto the canonical column names, so an effect the
        # Java side authored now survives the import intact — including the new targets.
        assert eff.id_choice == 1 and eff.statistics == "energy" and eff.value == 2
        assert eff.uuid and eff.id_card == 4 and eff.flag_group == 1
        assert eff.key == "gate" and eff.value_to_add == "OPEN"
        assert eff.id_event == 7 and eff.id_location == 8 and eff.id_weather == 9
        assert eff.id_item_target == 10 and eff.item_action == "ADD"
    adapter.save_cards(story_id, [{"cardType": "test"}])
    adapter.save_keys(story_id, [{"keyName": "key", "keyValue": "val"}])
    adapter.save_traits(story_id, [{"idTextName": 1}])
    adapter.save_character_templates(story_id, [{"idTextName": 1}])
    adapter.save_weather_rules(story_id, [{"idTextName": 1}])
    adapter.save_global_random_events(story_id, [{"idEvent": 1}])
    adapter.save_missions(story_id, [{"idTextName": 1, "steps": [{"conditionKey": "key"}]}])
    adapter.save_creators(story_id, [{"creatorName": "test"}])


def test_save_items_imports_the_step34_gates(adapter):
    """v0.34.0 — is_consumabile and the two class gates finally survive an import."""
    from app.adapters.persistence.story.models import ItemEntity

    story_id = adapter.save_story({"uuid": "test-item-gates"})
    adapter.save_items(story_id, [{
        "id": 900, "idTextName": 400, "weight": 3, "isConsumabile": 0,
        "idClassPermitted": 8, "idClassProhibited": 0,
    }])

    with adapter.session_factory() as session:
        it = session.query(ItemEntity).filter_by(id_story=story_id, id=900).one()
    assert it.is_consumabile == 0
    assert it.id_class_permitted == 8
    # 0 means "no restriction" and is normalised to None, as the importer does elsewhere.
    assert it.id_class_prohibited is None


def test_save_item_effects_imports_the_canonical_top_level_array(adapter):
    """v0.34.0 — same shape as Java and AWS: top-level itemEffects keyed by idItem."""
    from app.adapters.persistence.story.models import ItemEffectEntity

    story_id = adapter.save_story({"uuid": "test-item-effects"})
    adapter.save_items(story_id, [{"id": 900, "idTextName": 400, "weight": 1}])
    adapter.save_item_effects(story_id, [{
        "id": 1, "idItem": 900, "effectCode": "SADNESS", "effectValue": -2,
        "traitsToAdd": "90001,90002", "traitsToRemove": "90004", "idCard": 77,
    }])

    with adapter.session_factory() as session:
        ef = session.query(ItemEffectEntity).filter_by(id_story=story_id, id=1).one()
    assert ef.id_item == 900
    assert ef.effect_code == "SADNESS"
    assert ef.effect_value == -2
    assert ef.traits_to_add == "90001,90002"
    assert ef.traits_to_remove == "90004"
    assert ef.id_card == 77
    assert ef.uuid is not None


def test_link_deferred_references_writes_the_forward_pointers(adapter, session_factory):
    # v0.35.8 — id_event_next points at an event further down the same list, id_item_to_add
    # at an item imported later, and the location/weather trigger columns at events imported
    # after them. Writing any of these on the first insert breaks the PostgreSQL foreign keys,
    # so the import fills them in a second pass, addressing the rows by uuid.
    from app.adapters.persistence.story.models import (
        EventEntity, LocationEntity, WeatherRuleEntity)
    story_id = adapter.save_story({"uuid": "test-uuid-deferred"})
    data = {
        "locations": [{"id": 1, "uuid": "loc-1", "idEventIfCounterZero": 10,
                       "idEventIfCharacterEnterFirstTime": 12}],
        "events": [{"id": 5, "uuid": "ev-5", "idEventNext": 6, "idItemToAdd": 2},
                   {"id": 6, "uuid": "ev-6"}],
        "weatherRules": [{"id": 1, "uuid": "wr-1", "idEvent": 5, "probability": 50}],
    }
    adapter.save_locations(story_id, data["locations"])
    adapter.save_events(story_id, data["events"])
    adapter.save_weather_rules(story_id, data["weatherRules"])

    with session_factory() as session:
        # first insert: every forward reference is still empty
        assert session.query(EventEntity).filter_by(id_story=story_id, id=5).one().id_event_next is None
        assert session.query(LocationEntity).filter_by(
            id_story=story_id, id=1).one().id_event_if_counter_zero is None

    adapter.link_deferred_references(story_id, data)

    with session_factory() as session:
        event = session.query(EventEntity).filter_by(id_story=story_id, id=5).one()
        assert event.id_event_next == 6
        assert event.id_item_to_add == 2
        location = session.query(LocationEntity).filter_by(id_story=story_id, id=1).one()
        assert location.id_event_if_counter_zero == 10
        # the pre-V0.33.2 key fills the renamed column
        assert location.id_event_if_character_enter_empty_location == 12
        rule = session.query(WeatherRuleEntity).filter_by(id_story=story_id, id=1).one()
        assert rule.id_event == 5


def test_link_deferred_references_ignores_missing_and_zero_values(adapter, session_factory):
    from app.adapters.persistence.story.models import EventEntity
    story_id = adapter.save_story({"uuid": "test-uuid-deferred-none"})
    # 0 means "none" in the authored JSON, and "" is what the admin form writes for an
    # empty numeric field — neither may reach an integer column.
    data = {"events": [{"id": 1, "uuid": "ev-1", "idEventNext": 0, "idItemToAdd": ""},
                       {"id": 2, "uuid": None, "idEventNext": 1}]}
    adapter.save_events(story_id, data["events"])
    adapter.link_deferred_references(story_id, data)

    with session_factory() as session:
        rows = session.query(EventEntity).filter_by(id_story=story_id).order_by(EventEntity.id).all()
        assert rows[0].id_event_next is None
        assert rows[0].id_item_to_add is None
        # a row without a uuid cannot be addressed: it is skipped, not crashed on
        assert rows[1].id_event_next is None


def test_save_location_neighbors_top_level_array(adapter, session_factory):
    # v0.35.8 — the canonical contract puts the edges in a top-level `locationNeighbors`
    # array (tutorial_story.json has 22 of them). Python only read the nested
    # `location.neighbors`, so an imported story had locations and no movements at all.
    from app.adapters.persistence.story.models import LocationNeighborEntity
    story_id = adapter.save_story({"uuid": "test-uuid-neighbors"})
    adapter.save_locations(story_id, [{"id": 1, "uuid": "loc-1"}, {"id": 3, "uuid": "loc-3"}])
    adapter.save_location_neighbors(story_id, [{
        "id": 1, "uuid": "nb-1",
        "idLocationFrom": 1, "idLocationTo": 3, "direction": "NORTH",
        "energyCost": 0, "flagBack": 1,
        "idCard": 51, "idCardBack": 55,
        "idTextName": 139, "idTextGo": 109, "idTextBack": 110,
        "costFood": 1, "costMagic": 2, "costCoin": 3,
        "conditionRegistryKey": "door", "conditionRegistryValue": "open",
    }])

    with session_factory() as session:
        edge = session.query(LocationNeighborEntity).filter_by(id_story=story_id, id=1).one()
        assert (edge.id_location_from, edge.id_location_to) == (1, 3)
        assert edge.direction == "NORTH"
        assert edge.flag_back == 1
        assert (edge.id_card, edge.id_card_back) == (51, 55)
        assert (edge.id_text_name, edge.id_text_go, edge.id_text_back) == (139, 109, 110)
        assert (edge.cost_food, edge.cost_magic, edge.cost_coin) == (1, 2, 3)
        # canonical conditionRegistry* keys land in the condition_registry_* columns
        assert (edge.condition_registry_key, edge.condition_registry_value) == ("door", "open")


def test_save_location_neighbors_empty_costs_and_nested_form(adapter, session_factory):
    from app.adapters.persistence.story.models import LocationNeighborEntity
    story_id = adapter.save_story({"uuid": "test-uuid-neighbors-2"})
    # the nested form (Python's own) keeps working, with the short condition keys
    adapter.save_locations(story_id, [{
        "id": 1, "uuid": "loc-1",
        "neighbors": [{"idLocationTo": 2, "direction": "WEST",
                       "conditionKey": "k", "conditionValue": "v"}],
    }])
    # "" in a numeric field is what the admin form writes for an empty cost
    adapter.save_location_neighbors(story_id, [{
        "id": 9, "uuid": "nb-9", "idLocationFrom": 1, "idLocationTo": 2,
        "direction": "EAST", "energyCost": "", "idCard": "",
    }])

    with session_factory() as session:
        nested = session.query(LocationNeighborEntity).filter_by(
            id_story=story_id, direction="WEST").one()
        assert (nested.condition_registry_key, nested.condition_registry_value) == ("k", "v")
        edge = session.query(LocationNeighborEntity).filter_by(id_story=story_id, id=9).one()
        # "" is coerced away: a column with a default falls back to it (energy_cost=1),
        # one without stays NULL — never the string "" that PostgreSQL rejects.
        assert edge.energy_cost == 1
        assert edge.id_card is None


def test_delete_story_by_id_removes_the_matches_played_on_it(adapter, session_factory):
    # v0.35.8 — gaming_match.id_story references list_stories, so a story with matches
    # could not be deleted at all: "still referenced from table gaming_match".
    import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
    from app.adapters.persistence.match.models import GamingMatchEntity
    from app.adapters.persistence.story.models import CreatorEntity, CardEntity

    story_id = adapter.save_story({"uuid": "test-uuid-delete-match"})
    other_id = adapter.save_story({"uuid": "test-uuid-delete-other"})
    adapter.save_creators(story_id, [{"id": 1, "uuid": "cr-1"}])
    adapter.save_cards(story_id, [{"id": 1, "uuid": "cd-1", "idCreator": 1}])
    with session_factory() as session:
        session.add(GamingMatchEntity(
            id=1, uuid="m-1", id_story=story_id, id_difficulty=1, id_user_creator=7,
            status="RUNNING", ts_insert="2024-01-01T00:00:00", ts_update="2024-01-01T00:00:00"))
        session.add(GamingMatchEntity(
            id=2, uuid="m-2", id_story=other_id, id_difficulty=1, id_user_creator=7,
            status="RUNNING", ts_insert="2024-01-01T00:00:00", ts_update="2024-01-01T00:00:00"))
        session.commit()

    adapter.delete_story_by_id(story_id)

    with session_factory() as session:
        assert session.query(StoryEntity).filter_by(id=story_id).first() is None
        # only the matches of THIS story go; another story's are untouched
        assert session.query(GamingMatchEntity).filter_by(id_story=story_id).count() == 0
        assert session.query(GamingMatchEntity).filter_by(id_story=other_id).count() == 1
        # cards carry id_creator, so the creators must survive until the cards are gone
        assert session.query(CardEntity).filter_by(id_story=story_id).count() == 0
        assert session.query(CreatorEntity).filter_by(id_story=story_id).count() == 0


def test_delete_story_by_id_removes_the_state_hanging_off_each_match(adapter, session_factory):
    # v0.35.8 — the id_match FKs only cascade on a schema created after this version.
    # On an older database they block the delete ("still referenced from table
    # gaming_state_locations"), so the rows under a match are removed explicitly.
    import app.adapters.persistence.match.models  # noqa: F401  registers gaming_* tables
    from app.adapters.persistence.match.models import (
        GamingMatchEntity, GamingStateLocationEntity, GamingCharacterInstanceEntity,
        LogMovementEntity)

    story_id = adapter.save_story({"uuid": "test-uuid-delete-state"})
    other_id = adapter.save_story({"uuid": "test-uuid-delete-state-other"})
    now = "2024-01-01T00:00:00"
    with session_factory() as session:
        for match_id, owner in ((1, story_id), (2, other_id)):
            session.add(GamingMatchEntity(
                id=match_id, uuid=f"m-{match_id}", id_story=owner, id_difficulty=1,
                id_user_creator=7, status="RUNNING", ts_insert=now, ts_update=now))
            session.add(GamingStateLocationEntity(
                id_match=match_id, id_location=100, uuid=f"sl-{match_id}",
                ts_insert=now, ts_update=now))
            session.add(GamingCharacterInstanceEntity(
                id=match_id, id_match=match_id, uuid=f"ch-{match_id}", id_user=7,
                id_character_template=1, id_location=100, ts_insert=now, ts_update=now))
            session.add(LogMovementEntity(
                id=match_id, id_match=match_id, uuid=f"lm-{match_id}",
                id_character_match=match_id, id_location_from=100, id_location_to=200,
                ts_insert=now, ts_update=now))
        session.commit()

    adapter.delete_story_by_id(story_id)

    with session_factory() as session:
        for entity in (GamingStateLocationEntity, GamingCharacterInstanceEntity,
                       LogMovementEntity, GamingMatchEntity):
            column = entity.id if entity is GamingMatchEntity else entity.id_match
            assert session.query(entity).filter(column == 1).count() == 0
            # the other story's match keeps every one of its rows
            assert session.query(entity).filter(column == 2).count() == 1


def test_save_items_leaves_the_schema_defaults_to_the_schema(adapter, session_factory):
    """v0.35.8 — an item that declares neither weight nor isConsumabile takes the schema
    default (weight 1, consumable), exactly as Java's ItemEntity @PrePersist does. The
    import used to force weight=0, so such an item silently weighed nothing."""
    from app.adapters.persistence.story.models import ItemEntity
    story_id = adapter.save_story({"uuid": "test-uuid-item-defaults"})
    adapter.save_items(story_id, [
        {"id": 1, "uuid": "it-1", "idCard": 112, "maxPerCharacter": 1, "weight": 0},
        {"id": 2, "uuid": "it-2"},
        {"id": 3, "uuid": "it-3", "isConsumabile": False, "weight": 5,
         "flagShowEffects": False},
    ])

    with session_factory() as session:
        rows = {r.id: r for r in session.query(ItemEntity).filter_by(id_story=story_id).all()}
        # an explicit 0 is honoured — it is a weightless item, not a missing value
        assert rows[1].weight == 0
        assert rows[1].is_consumabile == 1
        # nothing declared: the schema decides, and it says 1 / consumable / show effects
        assert rows[2].weight == 1
        assert rows[2].is_consumabile == 1
        assert rows[2].flag_show_effects == 1
        # and what the story DOES declare always wins
        assert rows[3].weight == 5
        assert rows[3].is_consumabile == 0
        assert rows[3].flag_show_effects == 0


def test_save_items_imports_every_item_of_the_array(adapter, session_factory):
    from app.adapters.persistence.story.models import ItemEntity
    story_id = adapter.save_story({"uuid": "test-uuid-item-all"})
    adapter.save_items(story_id, [{"id": i, "uuid": f"it-{i}"} for i in (1, 2, 3)])

    with session_factory() as session:
        assert [r.id for r in session.query(ItemEntity).filter_by(
            id_story=story_id).order_by(ItemEntity.id).all()] == [1, 2, 3]


def test_item_flags_survive_the_export_round_trip(adapter, session_factory):
    """v0.35.8 — an item that is NOT consumable and hides its effects must come back the
    same after export + re-import. A 0 dropped anywhere in the chain would fall back to the
    schema default (1) and quietly flip both flags."""
    from app.adapters.persistence.story.models import ItemEntity
    from app.adapters.persistence.story.story_read_adapter import StoryReadAdapter
    from app.core.services.story.story_crud_service import StoryCrudService

    story_id = adapter.save_story({"uuid": "round-trip"})
    adapter.save_items(story_id, [
        {"id": 1, "uuid": "it-1", "isConsumabile": False, "flagShowEffects": False, "weight": 3},
        {"id": 2, "uuid": "it-2", "isConsumabile": 0, "flagShowEffects": 0},
    ])

    # what GET /api/admin/stories/{uuid}/items answers, which is what the export writes
    rows = StoryCrudService(StoryReadAdapter(session_factory), adapter).list_entities(
        "round-trip", "items")
    assert [(r["id"], r["isConsumabile"], r["flagShowEffects"]) for r in rows] == [
        (1, 0, 0), (2, 0, 0)]

    # and back in, through the import
    exported = [{k: v for k, v in r.items()
                 if k not in ("tsInsert", "tsUpdate", "idStory")} for r in rows]
    other_id = adapter.save_story({"uuid": "round-trip-2"})
    adapter.save_items(other_id, exported)

    with session_factory() as session:
        again = session.query(ItemEntity).filter_by(id_story=other_id).order_by(ItemEntity.id).all()
        assert [(i.is_consumabile, i.flag_show_effects, i.weight) for i in again] == [
            (0, 0, 3), (0, 0, 1)]


def test_update_entity_coerces_the_admin_form_values(adapter, session_factory):
    """v0.35.8 — the admin form PUTs JSON booleans for the flag columns and "" for an
    empty number. The insert path coerced them; the update path set them raw, and
    PostgreSQL refused: "column is_consumabile is of type integer but expression is of
    type boolean"."""
    from app.adapters.persistence.story.models import ItemEntity
    story_id = adapter.save_story({"uuid": "test-uuid-update-coerce"})
    adapter.save_items(story_id, [{"id": 1, "uuid": "it-1", "isConsumabile": 1,
                                   "flagShowEffects": 1, "weight": 2}])

    adapter.update_entity(story_id, "list_items", "it-1", {
        "isConsumabile": False, "flagShowEffects": False,
        "maxPerCharacter": "", "weight": "5",
    })

    with session_factory() as session:
        item = session.query(ItemEntity).filter_by(id_story=story_id, id=1).one()
        # SQLite stores a bool as 0/1 either way — PostgreSQL is where the raw bool was
        # refused — so what this pins is the value, and that "" never reaches the column.
        assert item.is_consumabile == 0 and not isinstance(item.is_consumabile, bool)
        assert item.flag_show_effects == 0
        # "" is not a number: the column goes back to NULL, never to the string
        assert item.max_per_character is None
        # and a numeric string is still a number
        assert item.weight == 5


def test_update_story_by_id_coerces_its_values(adapter, session_factory):
    from app.adapters.persistence.story.models import StoryEntity
    story_id = adapter.save_story({"uuid": "test-uuid-update-story-coerce"})

    adapter.update_story_by_id(story_id, {"priority": "3", "idCard": "", "author": "Me"})

    with session_factory() as session:
        story = session.query(StoryEntity).filter_by(id=story_id).one()
        assert story.priority == 3
        assert story.id_card is None
        assert story.author == "Me"


def test_delete_story_clears_the_pointers_into_the_events_first(adapter, session_factory):
    """v0.35.8 — an event chained to another event, and a weather rule naming one: both
    point INTO a table the delete empties, and PostgreSQL refuses to remove a row while a
    pointer to it still stands. SQLite does not enforce it, which is why this only ever
    failed on a real deployment."""
    from app.adapters.persistence.story.models import EventEntity, WeatherRuleEntity
    story_id = adapter.save_story({"uuid": "test-uuid-delete-chain"})
    adapter.save_events(story_id, [{"id": 5, "uuid": "ev-5"}, {"id": 6, "uuid": "ev-6"}])
    adapter.save_weather_rules(story_id, [{"id": 1, "uuid": "wr-1", "probability": 50}])
    adapter.link_deferred_references(story_id, {
        "events": [{"id": 5, "uuid": "ev-5", "idEventNext": 6}, {"id": 6, "uuid": "ev-6"}],
        "weatherRules": [{"id": 1, "uuid": "wr-1", "idEvent": 6}],
    })
    with session_factory() as session:
        assert session.query(EventEntity).filter_by(id_story=story_id, id=5).one().id_event_next == 6
        assert session.query(WeatherRuleEntity).filter_by(id_story=story_id, id=1).one().id_event == 6

    adapter.delete_story_by_id(story_id)

    with session_factory() as session:
        assert session.query(EventEntity).filter_by(id_story=story_id).count() == 0
        assert session.query(WeatherRuleEntity).filter_by(id_story=story_id).count() == 0
        assert session.query(StoryEntity).filter_by(id=story_id).first() is None


def test_every_imported_row_gets_a_uuid(adapter, session_factory):
    """v0.35.8 — the keys, weather-rules and global-random-events field maps did not carry
    the uuid, so those rows landed without one: the admin CRUD addresses an entity by uuid
    (GET/PUT/DELETE .../{entityUuid}) and could not reach them at all."""
    from app.adapters.persistence.story.models import (
        KeyEntity, WeatherRuleEntity, GlobalRandomEventEntity)
    story_id = adapter.save_story({"uuid": "test-uuid-row-uuids"})
    adapter.save_keys(story_id, [{"id": 1, "keyName": "door"}])
    adapter.save_weather_rules(story_id, [{"id": 1, "probability": 50},
                                          {"id": 2, "uuid": "wr-authored", "probability": 10}])
    adapter.save_global_random_events(story_id, [{"id": 1, "probability": 5}])

    with session_factory() as session:
        for entity in (KeyEntity, WeatherRuleEntity, GlobalRandomEventEntity):
            for row in session.query(entity).filter_by(id_story=story_id).all():
                assert row.uuid, f"{entity.__name__} {row.id} was imported without a uuid"
        # an authored uuid is kept, never replaced
        authored = session.query(WeatherRuleEntity).filter_by(id_story=story_id, id=2).one()
        assert authored.uuid == "wr-authored"
