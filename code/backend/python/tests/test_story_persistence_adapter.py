import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.adapters.persistence.story.models import Base, StoryEntity, TextEntity
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
    adapter.save_locations(story_id, [{"idTextName": 1, "neighbors": [{"idLocationTo": 2, "direction": "N"}]}])
    adapter.save_events(story_id, [{"idTextName": 1, "effects": [{"effectType": "HP", "effectValue": 10}]}])
    adapter.save_items(story_id, [{"idTextName": 1, "effects": [{"effectType": "HP", "effectValue": 10}]}])
    adapter.save_classes(story_id, [{"idTextName": 1, "bonuses": [{"bonusType": "STR", "bonusValue": 10}]}])
    adapter.save_choices(story_id, [{"idTextName": 1, "conditions": [{"conditionType": "STR", "conditionKey": "val"}], "effects": [{"effectType": "HP", "effectValue": 10}]}])
    adapter.save_cards(story_id, [{"cardType": "test"}])
    adapter.save_keys(story_id, [{"keyName": "key", "keyValue": "val"}])
    adapter.save_traits(story_id, [{"idTextName": 1}])
    adapter.save_character_templates(story_id, [{"idTextName": 1}])
    adapter.save_weather_rules(story_id, [{"idTextName": 1}])
    adapter.save_global_random_events(story_id, [{"idEvent": 1}])
    adapter.save_missions(story_id, [{"idTextName": 1, "steps": [{"conditionKey": "key"}]}])
    adapter.save_creators(story_id, [{"creatorName": "test"}])
