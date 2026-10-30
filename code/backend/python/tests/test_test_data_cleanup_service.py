"""Unit tests for the dev-only TestDataCleanupService."""
from unittest.mock import MagicMock

from app.core.models.dev.cleanup_result import CleanupResult
from app.core.services.dev.test_data_cleanup_service import TestDataCleanupService


def test_cleanup_test_data_deletes_marked_rows():
    guest_port = MagicMock()
    match_port = MagicMock()
    guest_port.delete_guests_by_username_like.return_value = 7
    match_port.delete_matches_by_name_like.return_value = 3
    service = TestDataCleanupService(guest_port, match_port)

    result = service.cleanup_test_data()

    assert result == CleanupResult(deleted_guests=7, deleted_matches=3)
    guest_port.delete_guests_by_username_like.assert_called_once_with("robottest%")
    match_port.delete_matches_by_name_like.assert_called_once_with("robottest%")


def test_cleanup_test_data_zero_when_nothing_matches():
    guest_port = MagicMock()
    match_port = MagicMock()
    guest_port.delete_guests_by_username_like.return_value = 0
    match_port.delete_matches_by_name_like.return_value = 0
    service = TestDataCleanupService(guest_port, match_port)

    result = service.cleanup_test_data()

    assert result.deleted_guests == 0
    assert result.deleted_matches == 0


def test_v120_cleanup_removes_robot_google_users_with_their_matches():
    guest_port, match_port, identities = MagicMock(), MagicMock(), MagicMock()
    guest_port.delete_guests_by_username_like.return_value = 0
    match_port.delete_matches_by_name_like.return_value = 1
    match_port.delete_matches_by_user_creator_ids.return_value = 2
    identities.find_non_guest_user_ids_by_nickname_like.return_value = [4, 5]
    result = TestDataCleanupService(guest_port, match_port, identities).cleanup_test_data()
    assert result == CleanupResult(deleted_guests=0, deleted_matches=3, deleted_users=2)
    identities.delete_user_fully.assert_any_call(5)
    identities.find_non_guest_user_ids_by_nickname_like.return_value = []
    assert TestDataCleanupService(guest_port, match_port, identities).cleanup_test_data().deleted_users == 0
