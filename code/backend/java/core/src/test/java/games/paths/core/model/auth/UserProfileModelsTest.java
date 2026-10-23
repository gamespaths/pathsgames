package games.paths.core.model.auth;

import games.paths.core.model.match.MatchStatusTotals;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** v1.7.0 {@link UserStats} folding and {@link UserPreferences} list parsing. */
class UserProfileModelsTest {

    @Test
    void statsFoldEveryPlayedStatusAndSkipTheOthers() {
        UserStats s = UserStats.of(List.of(new MatchStatusTotals("RUNNING", 1, 10, 1),
                new MatchStatusTotals("PAUSED", 1, 20, 2), new MatchStatusTotals("ENDED", 2, 30, 3),
                new MatchStatusTotals("GAMEOVER", 1, 40, 4), new MatchStatusTotals("CREATED", 5, 0, 0),
                new MatchStatusTotals("BANNED", 1, 50, 5), new MatchStatusTotals("FUTURE", 1, 60, 6)));
        assertEquals(new UserStats(5, 2, 1, 100, 10), s);
        assertEquals(UserStats.EMPTY, UserStats.of(null));
    }

    @Test
    void listsAreTrimmedLowercaseAndDistinct() {
        assertEquals(List.of("en", "it", "fr"), UserPreferences.parseList(" EN, it ,,fr,en", List.of("x")));
        assertEquals(List.of("x"), UserPreferences.parseList(" , ", List.of("x")));
        assertEquals(List.of("x"), UserPreferences.parseList(null, List.of("x")));
        assertTrue(new UserPreferences("en", "high-contrast").highContrast());
        assertFalse(new UserPreferences("en", "default").highContrast());
    }
}
