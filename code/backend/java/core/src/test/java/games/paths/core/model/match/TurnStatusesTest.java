package games.paths.core.model.match;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TurnStatusesTest {

    @Test
    void allContainsThreeStatuses() {
        assertEquals(List.of("WAITING", "ACTIVE", "COMPLETED"), TurnStatuses.ALL);
    }

    @Test
    void isValid_acceptsKnownStatuses() {
        assertTrue(TurnStatuses.isValid("WAITING"));
        assertTrue(TurnStatuses.isValid("ACTIVE"));
        assertTrue(TurnStatuses.isValid("COMPLETED"));
    }

    @Test
    void isValid_rejectsUnknownAndNull() {
        assertFalse(TurnStatuses.isValid("BOGUS"));
        assertFalse(TurnStatuses.isValid(""));
        assertFalse(TurnStatuses.isValid(null));
    }

    @Test
    void constants_matchListValues() {
        assertTrue(TurnStatuses.ALL.contains(TurnStatuses.WAITING));
        assertTrue(TurnStatuses.ALL.contains(TurnStatuses.ACTIVE));
        assertTrue(TurnStatuses.ALL.contains(TurnStatuses.COMPLETED));
    }
}
