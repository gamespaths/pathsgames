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
    void isActive_trueForCreatedRunningAndPaused() {
        assertTrue(MatchStatuses.isActive("CREATED"));
        assertTrue(MatchStatuses.isActive("RUNNING"));
        assertTrue(MatchStatuses.isActive("PAUSED"));
        assertFalse(MatchStatuses.isActive("ENDED"));
        assertFalse(MatchStatuses.isActive("GAMEOVER"));
        assertFalse(MatchStatuses.isActive(null));
    }

    @Test
    void activeAndTerminalPartitionAllStatuses() {
        assertEquals(MatchStatuses.ALL.size(),
                MatchStatuses.ACTIVE.size() + MatchStatuses.TERMINAL.size());
        MatchStatuses.ALL.forEach(s ->
                assertNotEquals(MatchStatuses.isActive(s), MatchStatuses.isTerminal(s)));
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
