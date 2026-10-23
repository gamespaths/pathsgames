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
 * Unit tests of {@link GuestMergeService}: v1.7.0 step 9 the Google user's active match of a story always
 * wins over the guest's; ended ones are kept; inside one side the latest ts_update stays.
 */
class GuestMergeServiceTest {

    private static MatchOwnership m(long id, long story, String status, String ts) {
        return new MatchOwnership(id, "m-" + id, story, status, ts);
    }

    private static List<Long> ids(List<MatchOwnership> list) {
        return list.stream().map(MatchOwnership::id).toList();
    }

    @Test
    void sameUserIsNoMerge() {
        GuestMergePersistencePort port = mock(GuestMergePersistencePort.class);
        assertEquals(0, new GuestMergeService(port).merge(1L, 1L).movedMatches());
        verifyNoInteractions(port);
    }

    @Test
    void mergeCancelsTheGuestMatchOfAStoryTheGoogleUserIsPlaying() {
        GuestMergePersistencePort port = mock(GuestMergePersistencePort.class);
        when(port.matchesOfUser(2L)).thenReturn(List.of(
                m(10L, 1L, "RUNNING", "2026-10-01T10:00:00Z"),
                m(11L, 2L, "ENDED", "2026-10-01T10:00:00Z")));
        when(port.matchesOfUser(5L)).thenReturn(List.of(
                m(20L, 1L, "PAUSED", "2026-10-02 09:00:00"),
                m(21L, 2L, "CREATED", "2026-10-01T09:00:00Z")));
        when(port.applyMerge(eq(5L), eq(2L), anyList(), anyString())).thenReturn(2);

        MergeResult result = new GuestMergeService(port).merge(5L, 2L);

        assertEquals(2, result.movedMatches());
        assertEquals(List.of(20L), result.cancelledMatchIds());
        assertEquals(List.of("m-20"), result.cancelledMatchUuids());
        verify(port).applyMerge(eq(5L), eq(2L), eq(List.of(20L)), anyString());
    }

    @Test
    void aNewerGuestMatchStillLoses() {
        List<MatchOwnership> cancel = GuestMergeService.matchesToCancel(
                List.of(m(1L, 1L, "CREATED", "2026-01-01T00:00:00Z")),
                List.of(m(2L, 1L, "RUNNING", "2026-12-31T00:00:00Z")));
        assertEquals(List.of(2L), ids(cancel));
    }

    @Test
    void noGoogleMatchKeepsTheGuestMatch() {
        assertTrue(GuestMergeService.matchesToCancel(List.of(),
                List.of(m(2L, 1L, "RUNNING", "t"))).isEmpty());
        assertTrue(GuestMergeService.matchesToCancel(null,
                List.of(m(2L, 1L, "RUNNING", "t"))).isEmpty());
    }

    @Test
    void differentStoriesAreAllKept() {
        assertTrue(GuestMergeService.matchesToCancel(
                List.of(m(1L, 1L, "RUNNING", "t")),
                List.of(m(2L, 2L, "RUNNING", "t"))).isEmpty());
    }

    @Test
    void anEndedGoogleMatchDoesNotBeatAnActiveGuestMatch() {
        assertTrue(GuestMergeService.matchesToCancel(
                List.of(m(1L, 1L, "ENDED", "t"), m(3L, 1L, "CANCELLED", "t")),
                List.of(m(2L, 1L, "RUNNING", "t"))).isEmpty());
    }

    @Test
    void endedAndCompletedAreAllKept() {
        List<MatchOwnership> cancel = GuestMergeService.matchesToCancel(
                List.of(m(3L, 1L, "RUNNING", "t")),
                List.of(m(1L, 1L, "ENDED", "t"), m(2L, 1L, "GAMEOVER", "t")));
        assertTrue(cancel.isEmpty());
    }

    @Test
    void insideOneSideTheLatestStaysAndTiesKeepTheHigherId() {
        List<MatchOwnership> cancel = GuestMergeService.matchesToCancel(List.of(),
                List.of(m(7L, 1L, "RUNNING", null), m(9L, 1L, "CREATED", "garbage"),
                        m(4L, 2L, "RUNNING", "2026-10-02T00:00:00Z"), m(5L, 2L, "RUNNING", "2026-10-01T00:00:00Z")));
        assertEquals(List.of(7L, 5L), ids(cancel));
        List<MatchOwnership> target = GuestMergeService.matchesToCancel(
                List.of(m(1L, 1L, "RUNNING", "2026-10-01T00:00:00Z"), m(2L, 1L, "PAUSED", "2026-10-03T00:00:00Z")),
                List.of(m(3L, 1L, "RUNNING", "2026-10-05T00:00:00Z")));
        assertEquals(List.of(1L, 3L), ids(target));
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
