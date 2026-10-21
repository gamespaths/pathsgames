from app.core.models.dev.cleanup_result import CleanupResult
from app.core.ports.auth.guest_admin_persistence_port import GuestAdminPersistencePort
from app.core.ports.dev.test_data_cleanup_port import TestDataCleanupPort
from app.core.ports.match.match_ports import MatchPersistencePort


class TestDataCleanupService(TestDataCleanupPort):
    """Removes guests and matches created by automated (Robot Framework) test
    runs, identified by the canonical ``robottest`` marker:

    * guest usernames start with ``robottest_`` (set when the ``X-Test-Marker``
      header is sent to ``POST /api/auth/guest``);
    * match names start with ``robottest_`` (set by the Robot test suites).

    All other rows are preserved.
    """

    # Tells pytest this is not a test class despite the "Test" name prefix.
    __test__ = False

    ROBOT_TEST_MARKER = "robottest"
    _MARKER_LIKE_PATTERN = ROBOT_TEST_MARKER + "%"

    def __init__(self, guest_persistence: GuestAdminPersistencePort,
                 match_persistence: MatchPersistencePort, identity_persistence=None):
        self.guest_persistence = guest_persistence
        self.match_persistence = match_persistence
        # v1.2.0 also the Google users of the fake provider (nickname robottest...) with their matches
        self.identity_persistence = identity_persistence

    def cleanup_test_data(self) -> CleanupResult:
        # Matches reference their guest creator via FK — delete them first.
        deleted_matches = self.match_persistence.delete_matches_by_name_like(
            self._MARKER_LIKE_PATTERN
        )
        deleted_users = 0
        if self.identity_persistence is not None:
            ids = self.identity_persistence.find_non_guest_user_ids_by_nickname_like(self._MARKER_LIKE_PATTERN)
            if ids:
                deleted_matches += self.match_persistence.delete_matches_by_user_creator_ids(ids)
                for user_id in ids:
                    self.identity_persistence.delete_user_fully(user_id)
                deleted_users = len(ids)
        deleted_guests = self.guest_persistence.delete_guests_by_username_like(
            self._MARKER_LIKE_PATTERN
        )
        return CleanupResult(deleted_guests=deleted_guests, deleted_matches=deleted_matches,
                             deleted_users=deleted_users)
