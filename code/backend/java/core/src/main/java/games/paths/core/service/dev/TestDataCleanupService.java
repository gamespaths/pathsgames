package games.paths.core.service.dev;

import games.paths.core.model.dev.CleanupResult;
import games.paths.core.port.auth.GuestAdminPersistencePort;
import games.paths.core.port.dev.TestDataCleanupPort;
import games.paths.core.port.match.MatchPersistencePort;

/**
 * TestDataCleanupService - Domain service implementing {@link TestDataCleanupPort}.
 * Pure domain logic with no Spring/framework dependency.
 *
 * <p>Removes guests and matches created by automated (Robot Framework) test
 * runs. Test rows are identified by the canonical {@value #ROBOT_TEST_MARKER}
 * marker:</p>
 * <ul>
 *   <li>guest usernames start with {@code robottest_}
 *       (see {@code GuestAuthService} — set when the {@code X-Test-Marker}
 *       header is sent to {@code POST /api/auth/guest})</li>
 *   <li>match names start with {@code robottest_}
 *       (set by the Robot test suites)</li>
 * </ul>
 */
public class TestDataCleanupService implements TestDataCleanupPort {

    /** Canonical marker token shared with the Robot test suites. */
    public static final String ROBOT_TEST_MARKER = "robottest";

    /** SQL LIKE pattern matching any robot-test username / match name. */
    private static final String MARKER_LIKE_PATTERN = ROBOT_TEST_MARKER + "%";

    private final GuestAdminPersistencePort guestPersistencePort;
    private final MatchPersistencePort matchPersistencePort;

    public TestDataCleanupService(GuestAdminPersistencePort guestPersistencePort,
                                  MatchPersistencePort matchPersistencePort) {
        this.guestPersistencePort = guestPersistencePort;
        this.matchPersistencePort = matchPersistencePort;
    }

    @Override
    public CleanupResult cleanupTestData() {
        // Matches are deleted before guests: a match references its creator
        // (a guest) via a foreign key, so the children must go first.
        int deletedMatches = matchPersistencePort.deleteMatchesByNameLike(MARKER_LIKE_PATTERN);
        int deletedGuests = guestPersistencePort.deleteGuestsByUsernameLike(MARKER_LIKE_PATTERN);
        return new CleanupResult(deletedGuests, deletedMatches);
    }
}
