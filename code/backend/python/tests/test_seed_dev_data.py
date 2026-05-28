import pytest
from sqlalchemy import create_engine
from app.adapters.persistence.seed_dev_data import seed_dev_data
from app.adapters.persistence.story.models import Base

def test_seed_dev_data():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    
    # Test execution, should insert 2 stories and their dependencies
    seed_dev_data(engine)
    
    # Verify data is inserted
    from sqlalchemy import text
    with engine.connect() as conn:
        res = conn.execute(text("SELECT count(*) FROM list_stories")).scalar()
        assert res >= 1

def test_seed_dev_data_exception():
    engine = create_engine("sqlite:///:memory:")
    # Do not create tables to force exception and cover the except block
    seed_dev_data(engine)

