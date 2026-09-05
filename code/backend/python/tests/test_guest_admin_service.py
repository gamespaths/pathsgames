import pytest
from unittest.mock import MagicMock
from app.core.services.auth.guest_admin_service import GuestAdminService
from app.core.models.auth.guest_info import GuestInfo
from app.core.models.auth.guest_stats import GuestStats


@pytest.fixture
def mock_persistence_port():
    port = MagicMock()
    return port


def test_list_all_guests(mock_persistence_port):
    mock_persistence_port.find_all_guests.return_value = [
        {
            "uuid": "uuid1",
            "username": "user1",
            "state": 6,
            "guest_cookie_token": "cookie1",
            "ts_registration": "2026-03-31T12:00:00Z",
        }
    ]
    service = GuestAdminService(mock_persistence_port)
    guests = service.list_all_guests()

    assert len(guests) == 1
    assert guests[0].user_uuid == "uuid1"
    assert guests[0].username == "user1"


def test_list_all_guests_empty(mock_persistence_port):
    mock_persistence_port.find_all_guests.return_value = []
    service = GuestAdminService(mock_persistence_port)

    assert service.list_all_guests() == []


def test_get_guest_stats(mock_persistence_port):
    mock_persistence_port.count_all_guests.return_value = 10
    mock_persistence_port.count_active_guests.return_value = 7
    mock_persistence_port.count_expired_guests.return_value = 3

    service = GuestAdminService(mock_persistence_port)
    stats = service.get_guest_stats()

    assert stats.total_guests == 10
    assert stats.active_guests == 7
    assert stats.expired_guests == 3


def test_get_guest_by_uuid_found(mock_persistence_port):
    mock_persistence_port.find_guest_by_uuid.return_value = {
        "uuid": "uuid1",
        "username": "user1",
        "state": 6,
        "guest_cookie_token": "cookie1",
    }
    service = GuestAdminService(mock_persistence_port)
    guest = service.get_guest_by_uuid("uuid1")

    assert guest is not None
    assert guest.user_uuid == "uuid1"


def test_get_guest_by_uuid_not_found(mock_persistence_port):
    mock_persistence_port.find_guest_by_uuid.return_value = None
    service = GuestAdminService(mock_persistence_port)
    guest = service.get_guest_by_uuid("nonexistent")

    assert guest is None


def test_get_guest_by_uuid_empty_string(mock_persistence_port):
    """Empty UUID string returns None without hitting persistence."""
    service = GuestAdminService(mock_persistence_port)
    guest = service.get_guest_by_uuid("")

    assert guest is None
    mock_persistence_port.find_guest_by_uuid.assert_not_called()


def test_delete_guest_success(mock_persistence_port):
    mock_persistence_port.delete_guest_by_uuid.return_value = True
    service = GuestAdminService(mock_persistence_port)

    assert service.delete_guest("uuid1") is True
    mock_persistence_port.delete_guest_by_uuid.assert_called_once_with("uuid1")


def test_delete_guest_not_found(mock_persistence_port):
    mock_persistence_port.delete_guest_by_uuid.return_value = False
    service = GuestAdminService(mock_persistence_port)

    assert service.delete_guest("nonexistent") is False


def test_delete_guest_empty_uuid(mock_persistence_port):
    """Empty UUID string returns False without hitting persistence."""
    service = GuestAdminService(mock_persistence_port)

    assert service.delete_guest("") is False
    mock_persistence_port.delete_guest_by_uuid.assert_not_called()


def test_delete_expired_guests(mock_persistence_port):
    mock_persistence_port.delete_expired_guests.return_value = 4
    service = GuestAdminService(mock_persistence_port)

    assert service.delete_expired_guests() == 4
    mock_persistence_port.delete_expired_guests.assert_called_once()



# --- _is_expired helper (extra coverage) ---

def test_is_expired_helper():
    from unittest.mock import MagicMock
    service = GuestAdminService(MagicMock())
    assert service._is_expired(None) is False
    assert service._is_expired("") is False
    assert service._is_expired("not-a-date") is False
    assert service._is_expired("2000-01-01T00:00:00Z") is True
    assert service._is_expired("2999-01-01T00:00:00+00:00") is False


# --- v0.36.2: paging and the stale purge ---

def _guest_row(row_id, last_access):
    return {"id": row_id, "uuid": f"g{row_id}", "username": f"u{row_id}", "role": "PLAYER",
            "state": 6, "guest_cookie_token": "c", "guest_expires_at": None,
            "language": "en", "ts_registration": "2020-01-01T00:00:00+00:00",
            "ts_last_access": last_access}


def test_a_full_page_answers_a_cursor_and_drops_the_over_fetched_row(mock_persistence_port):
    """The service asks for limit+1 to learn whether more exist, then hands back only limit."""
    rows = [_guest_row(i, f"2026-01-0{i}T00:00:00+00:00") for i in (3, 2, 1)]
    mock_persistence_port.find_guests_page.return_value = rows
    service = GuestAdminService(mock_persistence_port)

    page = service.list_guests_page(limit=2)

    assert mock_persistence_port.find_guests_page.call_args.args[3] == 3
    assert [g.user_uuid for g in page["items"]] == ["g3", "g2"]
    assert page["limit"] == 2
    assert page["next_cursor"] is not None


def test_the_last_page_answers_no_cursor(mock_persistence_port):
    mock_persistence_port.find_guests_page.return_value = [_guest_row(1, None)]
    service = GuestAdminService(mock_persistence_port)

    assert service.list_guests_page(limit=50)["next_cursor"] is None


def test_the_cursor_round_trips_to_the_row_it_named(mock_persistence_port):
    rows = [_guest_row(2, "2026-01-02T00:00:00+00:00"), _guest_row(1, "2026-01-01T00:00:00+00:00")]
    mock_persistence_port.find_guests_page.return_value = rows
    service = GuestAdminService(mock_persistence_port)

    cursor = service.list_guests_page(limit=1)["next_cursor"]
    service.list_guests_page(limit=1, cursor=cursor)

    ts_cursor, id_cursor = mock_persistence_port.find_guests_page.call_args.args[1:3]
    assert (ts_cursor, id_cursor) == ("2026-01-02T00:00:00+00:00", 2)


def test_a_malformed_cursor_restarts_at_page_one_instead_of_failing(mock_persistence_port):
    mock_persistence_port.find_guests_page.return_value = []
    service = GuestAdminService(mock_persistence_port)

    service.list_guests_page(cursor="not-a-cursor")

    assert mock_persistence_port.find_guests_page.call_args.args[1:3] == (None, None)


def test_a_guest_that_never_came_back_is_ordered_by_its_registration(mock_persistence_port):
    """ts_last_access is null for a guest that registered and never returned."""
    rows = [_guest_row(2, None), _guest_row(1, None)]
    mock_persistence_port.find_guests_page.return_value = rows
    service = GuestAdminService(mock_persistence_port)

    cursor = service.list_guests_page(limit=1)["next_cursor"]
    service.list_guests_page(limit=1, cursor=cursor)

    assert mock_persistence_port.find_guests_page.call_args.args[1] == "2020-01-01T00:00:00+00:00"


def test_the_stale_purge_takes_the_matches_before_the_guests(mock_persistence_port):
    """A match references its creator by foreign key, so the children must go first."""
    from unittest.mock import MagicMock, call
    matches = MagicMock()
    order = []
    mock_persistence_port.find_guest_ids_with_last_access_before.return_value = [7, 8]
    matches.delete_matches_by_user_creator_ids.side_effect = \
        lambda ids: order.append("matches") or 5
    mock_persistence_port.delete_guests_by_ids.side_effect = \
        lambda ids: order.append("guests") or 2
    service = GuestAdminService(mock_persistence_port, matches)

    assert service.delete_stale_guests(90) == {"guests": 2, "matches": 5}
    assert order == ["matches", "guests"]
    assert matches.delete_matches_by_user_creator_ids.call_args == call([7, 8])


def test_the_preview_deletes_nothing(mock_persistence_port):
    from unittest.mock import MagicMock
    matches = MagicMock()
    matches.count_matches_by_user_creator_ids.return_value = 5
    mock_persistence_port.find_guest_ids_with_last_access_before.return_value = [7, 8]
    service = GuestAdminService(mock_persistence_port, matches)

    assert service.preview_stale_guests(90) == {"guests": 2, "matches": 5}
    mock_persistence_port.delete_guests_by_ids.assert_not_called()
    matches.delete_matches_by_user_creator_ids.assert_not_called()


def test_a_purge_that_matches_nobody_touches_nothing(mock_persistence_port):
    from unittest.mock import MagicMock
    matches = MagicMock()
    mock_persistence_port.find_guest_ids_with_last_access_before.return_value = []
    service = GuestAdminService(mock_persistence_port, matches)

    assert service.delete_stale_guests(90) == {"guests": 0, "matches": 0}
    matches.delete_matches_by_user_creator_ids.assert_not_called()
