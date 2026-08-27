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


def _seeded_engine():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    seed_dev_data(engine)
    return engine


def test_seed_inserts_the_first_row_of_every_group():
    """The statement right after a comment block used to be skipped by the loader, which
    silently dropped the first row of each group (trait 90001 among them)."""
    from sqlalchemy import text
    with _seeded_engine().connect() as conn:
        assert conn.execute(
            text("SELECT count(*) FROM list_traits WHERE id = 90001")).scalar() == 1
        assert conn.execute(
            text("SELECT count(*) FROM list_locations WHERE id = 90001")).scalar() == 1


def test_seed_step29_events_and_effects():
    """Step 29: the events the robot suite drives — one per branch of the check procedure."""
    from sqlalchemy import text
    with _seeded_engine().connect() as conn:
        rows = conn.execute(text(
            "SELECT id, type, cost_enery, cost_coin, id_specific_location, id_event_next,"
            " id_item_condition, id_class_condition, id_weather, registry_key_condition"
            " FROM list_events WHERE id BETWEEN 90010 AND 90027")).fetchall()
        events = {r[0]: r for r in rows}
        assert len(events) == 18

        assert events[90010][1] == "NORMAL" and events[90010][2] == 1   # plain, costs energy
        assert events[90011][1] == "ONCE"
        assert events[90012][2] == 999                                  # NOT_ENOUGH_ENERGY
        assert events[90013][3] == 999                                  # NOT_ENOUGH_COINS
        assert events[90014][9] == "STEP29_GATE"                        # registry condition
        assert events[90015][6] == 90002                                # item condition
        assert events[90016][7] == 90002                                # class condition
        assert events[90017][8] == 90004                                # weather condition
        assert events[90018][4] == 90005                                # WRONG_LOCATION
        assert events[90019][5] == 90023                                # chain head -> tail
        assert events[90023][4] is None                                 # tail is not listed
        assert events[90027][1] == "AUTOMATIC"                          # never executable

        effects = conn.execute(text(
            "SELECT id, id_event, statistics, value, target, item_action, id_item_target,"
            " id_weather, traits_to_add, characteristic_to_add, key_to_add"
            " FROM list_events_effects WHERE id BETWEEN 90010 AND 90022")).fetchall()
        by_id = {r[0]: r for r in effects}
        assert len(by_id) == 13

        assert by_id[90015][10] == "STEP29_GATE"          # 90020 writes the registry key
        assert (by_id[90016][5], by_id[90016][6]) == ("ADD", 90002)   # 90021 grants the item
        assert by_id[90017][7] == 90004                   # 90022 sets the weather
        assert by_id[90019][8] == "90001"                 # 90025 adds a trait
        assert by_id[90019][9] == "BRAVE"                 # ...and a characteristic
        resources = {r[2]: r[3] for r in effects if r[1] == 90026}
        assert resources == {"food": 3, "magic": 2, "coin": 9}

