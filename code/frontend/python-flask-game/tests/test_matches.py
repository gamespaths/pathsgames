from app.matches import (create_match, get_match, join_match, list_matches)


def test_match_lifecycle(app):
    with app.test_request_context():
        m = create_match({"storyUuid": "s1", "storyTitle": "Story One"})
        assert m["status"] == "CREATED"
        assert m["uuid"]
        assert m["storyUuid"] == "s1"

        assert len(list_matches()) == 1
        assert get_match(m["uuid"])["uuid"] == m["uuid"]
        assert get_match("nope") is None

        joined = join_match(m["uuid"])
        assert joined["status"] == "RUNNING"


def test_matches_newest_first(app):
    with app.test_request_context():
        create_match({"storyUuid": "a"})
        second = create_match({"storyUuid": "b"})
        assert list_matches()[0]["uuid"] == second["uuid"]
