"""v1.7.0 step 9: tsUpdate in the match summary, list order and envelope, merge rule (Google match wins)."""
from unittest.mock import MagicMock

from app.core.models.auth.identity import MatchOwnership
from app.core.models.match.match_models import MatchSummary
from app.core.services.auth.guest_merge_service import GuestMergeService, matches_to_cancel
from app.core.services.match import match_list_order
from app.core.services.match.match_query_service import MatchQueryService
from app.core.services.match.match_stamp import iso_utc


def _s(uuid, status, ts_update=None, ts_insert=None):
    return MatchSummary(uuid=uuid, story_uuid="s", difficulty_uuid="d", name=None, status=status, current_clock=0,
                        exp_cost=0, user_creator_uuid="u", ts_insert=ts_insert, ts_update=ts_update)


def _row(uuid, status, ts_update, mid=1):
    return {"id": mid, "uuid": uuid, "id_story": 2, "id_difficulty": 3, "id_user_creator": 7, "name": "n",
            "status": status, "current_clock": 0, "exp_cost": 5, "ts_insert": "2026-01-01 00:00:00",
            "ts_update": ts_update}


def _query(rows):
    persistence, user_access = MagicMock(), MagicMock()
    user_access.find_by_uuid.return_value = {"id": 7, "uuid": "u"}
    persistence.find_matches_by_user_id.return_value = rows
    story_read = MagicMock()
    story_read.find_story_by_id.return_value = None
    return MatchQueryService(persistence, story_read, user_access, registry_service_instance=MagicMock())


# ── tsUpdate ────────────────────────────────────────────────────────────────

def test_iso_utc_normalizes_every_stored_form():
    assert iso_utc("2026-10-22 10:00:00") == "2026-10-22T10:00:00Z"
    assert iso_utc("2026-10-22T10:00:00+02:00") == "2026-10-22T08:00:00Z"
    assert iso_utc("2026-10-22T10:00:00.123456+00:00") == "2026-10-22T10:00:00.123456Z"
    assert iso_utc("2026-10-22T10:00:00.123Z") == "2026-10-22T10:00:00.123Z"
    assert iso_utc(None) is None and iso_utc("nope") == "nope"


def test_ts_update_is_iso_and_moves_with_a_write():
    row = _row("m1", "RUNNING", "2026-10-22 10:00:00")
    service = _query([row])
    assert service.list_user_matches("u")[0].ts_update == "2026-10-22T10:00:00Z"
    row["ts_update"] = "2026-10-22T10:05:00.000001+00:00"
    after = service.list_user_matches("u")[0]
    assert after.ts_update == "2026-10-22T10:05:00.000001Z"
    assert after.match_version == "2026-10-22T10:05:00.000001+00:00"


# ── order and envelope ──────────────────────────────────────────────────────

def test_active_first_then_last_played():
    ordered = match_list_order.sort([
        _s("cancelled", "CANCELLED", "2026-10-22T12:00:00Z"),
        _s("running-old", "RUNNING", "2026-10-01T00:00:00Z"),
        _s("ended", "ENDED", "2026-10-21T00:00:00Z"),
        _s("paused", "PAUSED", "2026-10-10T00:00:00Z"),
        _s("created", "CREATED", "2026-10-05 00:00:00"),
    ])
    assert [m.uuid for m in ordered] == ["paused", "created", "running-old", "cancelled", "ended"]


def test_missing_ts_update_falls_back_on_ts_insert_then_uuid():
    ordered = match_list_order.sort([
        _s("b", "RUNNING", None, "2026-10-01T00:00:00Z"),
        _s("a", "RUNNING", "garbage", "2026-10-02T00:00:00Z"),
        _s(None, "RUNNING"),
        _s("c", "RUNNING"),
    ])
    assert [m.uuid for m in ordered] == ["a", "b", None, "c"]
    assert match_list_order.sort(None) == []


def test_next_cursor_is_null_up_to_fifty():
    fifty = [_s(f"m{i:02d}", "ENDED", f"2026-10-01T00:00:{i:02d}Z") for i in range(50)]
    page = match_list_order.page(fifty)
    assert len(page.items) == 50 and page.next_cursor is None and page.limit == 50


def test_beyond_fifty_the_cursor_is_a_position():
    many = [_s(f"m{i:02d}", "ENDED", "2026-10-01T00:00:00Z") for i in range(51)]
    first = match_list_order.page(many, None, "")
    assert first.next_cursor == "50"
    second = match_list_order.page(many, None, first.next_cursor)
    assert len(second.items) == 1 and second.next_cursor is None
    assert match_list_order.page(many, 10, "999").items == []


def test_limit_and_cursor_are_clamped():
    assert match_list_order.clamp_limit(None) == 50
    assert match_list_order.clamp_limit("x") == 50
    assert match_list_order.clamp_limit(0) == 1
    assert match_list_order.clamp_limit(500) == 200
    assert match_list_order.offset_of(None) == 0
    assert match_list_order.offset_of("abc") == 0
    assert match_list_order.offset_of("-4") == 0
    assert match_list_order.offset_of(" 7 ") == 7


def test_service_page_sorts_the_user_matches():
    service = _query([_row("ended", "ENDED", "2026-10-22T12:00:00Z", 1),
                      _row("old", "CREATED", "2026-10-01T00:00:00Z", 2),
                      _row("paused", "PAUSED", "2026-10-20T00:00:00Z", 3)])
    page = service.list_user_matches_page("u")
    assert [m.uuid for m in page.items] == ["paused", "old", "ended"]
    assert page.next_cursor is None and page.limit == 50
    first = service.list_user_matches_page("u", 2)
    assert first.next_cursor == "2"
    assert [m.uuid for m in service.list_user_matches_page("u", 2, "2").items] == ["ended"]


# ── merge rule ──────────────────────────────────────────────────────────────

def _m(mid, story, status, ts=None):
    return MatchOwnership(mid, f"m-{mid}", story, status, ts)


def _ids(cancel):
    return [m.id for m in cancel]


def test_google_active_match_wins_and_uuids_are_returned():
    port = MagicMock()
    port.matches_of_user.side_effect = lambda uid: {
        2: [_m(10, 1, "RUNNING", "2026-10-01T10:00:00Z"), _m(11, 2, "ENDED")],
        5: [_m(20, 1, "PAUSED", "2026-10-02 09:00:00"), _m(21, 2, "CREATED")],
    }[uid]
    port.apply_merge.return_value = 2
    result = GuestMergeService(port).merge(5, 2)
    assert result.cancelled_match_ids == [20] and result.cancelled_match_uuids == ["m-20"]
    assert port.apply_merge.call_args.args[2] == [20]


def test_a_newer_guest_match_still_loses():
    assert _ids(matches_to_cancel([_m(1, 1, "CREATED", "2026-01-01T00:00:00Z")],
                                  [_m(2, 1, "RUNNING", "2026-12-31T00:00:00Z")])) == [2]


def test_no_google_match_keeps_the_guest_match():
    assert matches_to_cancel([], [_m(2, 1, "RUNNING")]) == []
    assert matches_to_cancel(None, [_m(2, 1, "RUNNING")]) == []


def test_different_stories_and_ended_matches_are_kept():
    assert matches_to_cancel([_m(1, 1, "RUNNING")], [_m(2, 2, "RUNNING")]) == []
    assert matches_to_cancel([_m(1, 1, "ENDED"), _m(3, 1, "CANCELLED")], [_m(2, 1, "RUNNING")]) == []
    assert matches_to_cancel([_m(3, 1, "RUNNING")], [_m(1, 1, "ENDED"), _m(2, 1, "GAMEOVER")]) == []


def test_inside_one_side_the_latest_stays():
    cancel = matches_to_cancel([], [_m(7, 1, "RUNNING"), _m(9, 1, "CREATED", "garbage"),
                                    _m(4, 2, "RUNNING", "2026-10-02T00:00:00Z"),
                                    _m(5, 2, "RUNNING", "2026-10-01T00:00:00Z")])
    assert _ids(cancel) == [7, 5]
    target = matches_to_cancel([_m(1, 1, "RUNNING", "2026-10-01T00:00:00Z"),
                                _m(2, 1, "PAUSED", "2026-10-03T00:00:00Z")],
                               [_m(3, 1, "RUNNING", "2026-10-05T00:00:00Z")])
    assert _ids(target) == [1, 3]
