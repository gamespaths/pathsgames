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
