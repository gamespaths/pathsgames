import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.adapters.persistence.story.story_read_adapter import StoryReadAdapter
from app.adapters.persistence.story.models import (
    Base, StoryEntity, TextEntity, StoryDifficultyEntity,
    LocationEntity, EventEntity, ItemEntity, ClassEntity,
    CharacterTemplateEntity, TraitEntity, CardEntity, CreatorEntity
)

@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)

@pytest.fixture
def adapter(session_factory):
    return StoryReadAdapter(session_factory)

def test_find_difficulties_for_story(session_factory, adapter):
    with session_factory() as session:
        session.add(StoryDifficultyEntity(id_story=1, uuid="d1", exp_cost=10))
        session.commit()
    
    diffs = adapter.find_difficulties_for_story(1)
    assert len(diffs) == 1
    assert diffs[0]["uuid"] == "d1"

def test_counts_for_story(session_factory, adapter):
    with session_factory() as session:
        session.add(LocationEntity(id_story=1))
        session.add(EventEntity(id_story=1))
        session.add(ItemEntity(id_story=1))
        session.commit()
    
    assert adapter.count_locations_for_story(1) == 1
    assert adapter.count_events_for_story(1) == 1
    assert adapter.count_items_for_story(1) == 1

def test_find_groups_and_categories(session_factory, adapter):
    with session_factory() as session:
        session.add(StoryEntity(uuid="s1", visibility="PUBLIC", category="C1", group_name="G1"))
        session.add(StoryEntity(uuid="s2", visibility="PRIVATE", category="C2", group_name="G2"))
        session.commit()
    
    groups = adapter.find_unique_groups()
    assert "G1" in groups
    assert "G2" not in groups
    
    c_stories = adapter.find_stories_by_category("C1")
    assert len(c_stories) == 1
    
    g_stories = adapter.find_stories_by_group("G1")
    assert len(g_stories) == 1

def test_find_story_components(session_factory, adapter):
    with session_factory() as session:
        session.add(ClassEntity(id_story=1))
        session.add(CharacterTemplateEntity(id_story=1))
        session.add(TraitEntity(id_story=1))
        session.add(CardEntity(id_story=1, id=10, uuid="c1"))
        session.add(TextEntity(id_story=1, id_text=20, lang="en"))
        session.add(CreatorEntity(id_story=1, uuid="cr1"))
        session.commit()
        
    assert len(adapter.find_classes_for_story(1)) == 1
    assert len(adapter.find_character_templates_for_story(1)) == 1
    assert len(adapter.find_traits_for_story(1)) == 1
    
    card = adapter.find_card_for_story(1, 10)
    assert card is not None
    assert adapter.find_card_by_story_id_and_uuid(1, "c1") is not None
    assert adapter.find_text_by_story_id_text_and_lang(1, 20, "en") is not None
    assert adapter.find_creator_by_story_id_and_uuid(1, "cr1") is not None
    assert len(adapter.find_creators_for_story(1)) == 1

def test_find_generic_entities(session_factory, adapter):
    with session_factory() as session:
        session.add(LocationEntity(id_story=1, uuid="loc1"))
        session.commit()
        
    assert len(adapter.find_locations_for_story(1)) == 1
    assert len(adapter.find_events_for_story(1)) == 0
    assert len(adapter.find_items_for_story(1)) == 0
    assert len(adapter.find_cards_for_story(1)) == 0

    assert len(adapter.find_entities_for_story(1, "list_locations")) == 1
    assert adapter.find_entities_for_story(1, "invalid_table") == []
    
    ent = adapter.find_entity_by_story_and_uuid(1, "list_locations", "loc1")
    assert ent is not None
    assert adapter.find_entity_by_story_and_uuid(1, "invalid", "loc1") is None
