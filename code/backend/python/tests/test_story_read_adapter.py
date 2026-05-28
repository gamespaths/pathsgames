import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.adapters.persistence.story.story_read_adapter import StoryReadAdapter
from app.adapters.persistence.story.models import Base, StoryEntity, TextEntity

@pytest.fixture
def session_factory():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)

@pytest.fixture
def adapter(session_factory):
    return StoryReadAdapter(session_factory)

def test_find_public_stories(session_factory, adapter):
    with session_factory() as session:
        session.add(StoryEntity(uuid="s1", visibility="PUBLIC", priority=10))
        session.add(StoryEntity(uuid="s2", visibility="PRIVATE", priority=5))
        session.commit()
    
    stories = adapter.find_public_stories()
    assert len(stories) == 1
    assert stories[0]["uuid"] == "s1"

def test_find_all_stories(session_factory, adapter):
    with session_factory() as session:
        session.add(StoryEntity(uuid="s1", priority=10))
        session.add(StoryEntity(uuid="s2", priority=5))
        session.commit()
    
    stories = adapter.find_all_stories()
    assert len(stories) == 2

def test_find_story_by_uuid(session_factory, adapter):
    with session_factory() as session:
        session.add(StoryEntity(uuid="s1"))
        session.commit()
    
    story = adapter.find_story_by_uuid("s1")
    assert story is not None
    assert story["uuid"] == "s1"
    
    assert adapter.find_story_by_uuid("missing") is None

def test_find_texts_for_story(session_factory, adapter):
    with session_factory() as session:
        session.add(TextEntity(id=1, id_story=1, id_text=1, lang="en", short_text="Hello"))
        session.commit()
    
    texts = adapter.find_texts_for_story(1)
    assert len(texts) == 1
    assert texts[0]["short_text"] == "Hello"

def test_find_unique_categories(session_factory, adapter):
    with session_factory() as session:
        session.add(StoryEntity(uuid="s1", visibility="PUBLIC", category="Cat A"))
        session.add(StoryEntity(uuid="s2", visibility="PUBLIC", category="Cat A"))
        session.add(StoryEntity(uuid="s3", visibility="PUBLIC", category="Cat B"))
        session.commit()
    
    categories = adapter.find_unique_categories()
    assert sorted(categories) == ["Cat A", "Cat B"]
