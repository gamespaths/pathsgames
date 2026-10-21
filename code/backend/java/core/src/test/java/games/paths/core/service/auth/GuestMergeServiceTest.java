package games.paths.core.service.auth;

import games.paths.core.model.auth.MatchOwnership;
import games.paths.core.model.auth.MergeResult;
import games.paths.core.port.auth.GuestMergePersistencePort;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests of {@link GuestMergeService}: per story the latest STARTED match wins, ended ones are kept.
 */
class GuestMergeServiceTest {

    @Test
    void sameUserIsNoMerge() {
        GuestMergePersistencePort port = mock(GuestMergePersistencePort.class);
        assertEquals(0, new GuestMergeService(port).merge(1L, 1L).movedMatches());
        verifyNoInteractions(port);
    }

    @Test
    void mergeCancelsTheOlderStartedMatchOfTheSameStory() {
        GuestMergePersistencePort port = mock(GuestMergePersistencePort.class);
        when(port.matchesOfUser(2L)).thenReturn(List.of(
                new MatchOwnership(10L, "a", 1L, "RUNNING", "2026-10-01T10:00:00Z"),
                new MatchOwnership(11L, "b", 2L, "ENDED", "2026-10-01T10:00:00Z")));
        when(port.matchesOfUser(5L)).thenReturn(List.of(
                new MatchOwnership(20L, "c", 1L, "PAUSED", "2026-10-02 09:00:00"),
                new MatchOwnership(21L, "d", 2L, "CREATED", "2026-10-01T09:00:00Z")));
        when(port.applyMerge(eq(5L), eq(2L), anyList(), anyString())).thenReturn(2);

        MergeResult result = new GuestMergeService(port).merge(5L, 2L);

        assertEquals(2, result.movedMatches());
        assertEquals(List.of(10L), result.cancelledMatchIds());
    }

    @Test
    void endedAndCompletedAreAllKept() {
        List<Long> cancel = GuestMergeService.matchesToCancel(List.of(
                new MatchOwnership(1L, "a", 1L, "ENDED", "t"),
                new MatchOwnership(2L, "b", 1L, "GAMEOVER", "t"),
                new MatchOwnership(3L, "c", 1L, "RUNNING", "t")));
        assertTrue(cancel.isEmpty());
    }

    @Test
    void tieOnTimestampKeepsTheHigherId() {
        List<Long> cancel = GuestMergeService.matchesToCancel(List.of(
                new MatchOwnership(7L, "a", 1L, "RUNNING", null),
                new MatchOwnership(9L, "b", 1L, "CREATED", "garbage")));
        assertEquals(List.of(7L), cancel);
    }

    @Test
    void epochMillisFormats() {
        assertEquals(0, GuestMergeService.epochMillis(null));
        assertEquals(0, GuestMergeService.epochMillis(" "));
        assertEquals(0, GuestMergeService.epochMillis("nope"));
        assertEquals(GuestMergeService.epochMillis("2026-10-01T10:00:00Z"),
                GuestMergeService.epochMillis("2026-10-01 10:00:00"));
        assertEquals(GuestMergeService.epochMillis("2026-10-01T10:00:00Z"),
                GuestMergeService.epochMillis("2026-10-01T12:00:00+02:00"));
    }
}
