package games.paths.core.model.match;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link MatchStatuses}.
 */
class MatchStatusesTest {

    @Test
    void allContainsTheFiveLifecycleStatuses() {
        assertEquals(List.of("CREATED", "RUNNING", "PAUSED", "ENDED", "GAMEOVER"),
                MatchStatuses.ALL);
    }

    @Test
    void isValid_acceptsKnownStatuses_rejectsOthers() {
        assertTrue(MatchStatuses.isValid("ENDED"));
        assertTrue(MatchStatuses.isValid("CREATED"));
        assertFalse(MatchStatuses.isValid("BOGUS"));
        assertFalse(MatchStatuses.isValid(null));
    }

    @Test
    void isTerminal_trueOnlyForEndedAndGameover() {
        assertTrue(MatchStatuses.isTerminal("ENDED"));
        assertTrue(MatchStatuses.isTerminal("GAMEOVER"));
        assertFalse(MatchStatuses.isTerminal("CREATED"));
        assertFalse(MatchStatuses.isTerminal("RUNNING"));
        assertFalse(MatchStatuses.isTerminal("PAUSED"));
        assertFalse(MatchStatuses.isTerminal(null));
    }
}
