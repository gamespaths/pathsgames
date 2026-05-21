package games.paths.core.service.dev;

import games.paths.core.model.dev.CleanupResult;
import games.paths.core.port.auth.GuestAdminPersistencePort;
import games.paths.core.port.match.MatchPersistencePort;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link TestDataCleanupService}.
 * Verifies that the dev-only cleanup removes robot-test guests and matches
 * using the canonical {@code robottest%} LIKE pattern.
 */
@ExtendWith(MockitoExtension.class)
class TestDataCleanupServiceTest {

    private static final String EXPECTED_PATTERN = "robottest%";

    @Mock
    private GuestAdminPersistencePort guestPersistencePort;

    @Mock
    private MatchPersistencePort matchPersistencePort;

    @InjectMocks
    private TestDataCleanupService service;

    @Test
    void cleanupTestData_deletesMarkedMatchesAndGuests() {
        when(matchPersistencePort.deleteMatchesByNameLike(EXPECTED_PATTERN)).thenReturn(3);
        when(guestPersistencePort.deleteGuestsByUsernameLike(EXPECTED_PATTERN)).thenReturn(7);

        CleanupResult result = service.cleanupTestData();

        assertEquals(7, result.deletedGuests());
        assertEquals(3, result.deletedMatches());
        verify(matchPersistencePort).deleteMatchesByNameLike(EXPECTED_PATTERN);
        verify(guestPersistencePort).deleteGuestsByUsernameLike(EXPECTED_PATTERN);
    }

    @Test
    void cleanupTestData_deletesMatchesBeforeGuests() {
        when(matchPersistencePort.deleteMatchesByNameLike(anyString())).thenReturn(1);
        when(guestPersistencePort.deleteGuestsByUsernameLike(anyString())).thenReturn(1);

        service.cleanupTestData();

        // Matches reference their guest creator via FK — they must go first.
        InOrder inOrder = inOrder(matchPersistencePort, guestPersistencePort);
        inOrder.verify(matchPersistencePort).deleteMatchesByNameLike(anyString());
        inOrder.verify(guestPersistencePort).deleteGuestsByUsernameLike(anyString());
    }

    @Test
    void cleanupTestData_returnsZerosWhenNothingMatches() {
        when(matchPersistencePort.deleteMatchesByNameLike(anyString())).thenReturn(0);
        when(guestPersistencePort.deleteGuestsByUsernameLike(anyString())).thenReturn(0);

        CleanupResult result = service.cleanupTestData();

        assertEquals(0, result.deletedGuests());
        assertEquals(0, result.deletedMatches());
    }

    /**
     * Safety test: when robot-test rows and real ("good") rows are present
     * together, the cleanup must remove ONLY the robot-test rows. The mocked
     * ports apply the same prefix semantics as the SQL {@code LIKE 'robottest%'}
     * pattern the service is expected to pass.
     */
    @Test
    void cleanupTestData_deletesOnlyRobotRows_preservingGoodData() {
        List<String> guests = new ArrayList<>(List.of(
                "guest_real0001", "guest_real0002",
                "robottest_aaaa1111", "robottest_bbbb2222"));
        List<String> matches = new ArrayList<>(List.of(
                "My epic adventure", "robottest_match", "Another real match"));

        when(guestPersistencePort.deleteGuestsByUsernameLike(anyString()))
                .thenAnswer(inv -> removeByLikePattern(guests, inv.getArgument(0)));
        when(matchPersistencePort.deleteMatchesByNameLike(anyString()))
                .thenAnswer(inv -> removeByLikePattern(matches, inv.getArgument(0)));

        CleanupResult result = service.cleanupTestData();

        assertEquals(2, result.deletedGuests());
        assertEquals(1, result.deletedMatches());
        // the real ("good") rows must survive untouched
        assertEquals(List.of("guest_real0001", "guest_real0002"), guests);
        assertEquals(List.of("My epic adventure", "Another real match"), matches);
    }

    /**
     * Removes every entry matching an SQL {@code LIKE} pattern ending in
     * {@code %} (prefix match); returns the number of entries removed.
     */
    private static int removeByLikePattern(List<String> values, String likePattern) {
        String prefix = likePattern.endsWith("%")
                ? likePattern.substring(0, likePattern.length() - 1)
                : likePattern;
        int before = values.size();
        values.removeIf(v -> v.startsWith(prefix));
        return before - values.size();
    }
}
