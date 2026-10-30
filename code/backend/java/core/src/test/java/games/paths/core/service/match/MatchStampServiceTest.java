package games.paths.core.service.match;

import games.paths.core.model.match.RequestStamp;
import games.paths.core.model.match.StaleMatchException;
import games.paths.core.port.match.MatchStampPort;
import games.paths.core.port.match.MatchStampStorePort;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v1.7.0 the match stamp: one ts_update per request, play time capped, admin writes without play time. */
class MatchStampServiceTest {

    private final MatchStampStorePort store = mock(MatchStampStorePort.class);
    private final MatchStampService service = new MatchStampService(store, 300);

    @AfterEach
    void close() {
        RequestStamp.close();
    }

    private String openAt(String previous, long gapMs) {
        return openAt(previous, gapMs, null);
    }

    private String openAt(String previous, long gapMs, String ifMatch) {
        RequestStamp.open(ifMatch);
        String now = RequestStamp.now();
        String prev = previous != null ? previous : Instant.parse(now).minusMillis(gapMs).toString();
        when(store.findTsUpdate("m")).thenReturn(Optional.of(prev));
        when(store.claim(eq("m"), eq(prev), anyString(), anyLong())).thenReturn(true);
        return now;
    }

    @Test
    void aGameplayWriteClaimsAndAddsTheGap() {
        String now = openAt(null, 42_000);
        String prev = Instant.parse(now).minusMillis(42_000).toString();
        assertEquals(now, service.claimGameplay("m"));
        verify(store).claim("m", prev, now, 42_000L);
        verify(store, never()).stamp(any(), any(), anyLong());
        assertEquals(now, RequestStamp.claimedVersion("m"));
        assertEquals(now, RequestStamp.claimedVersion());
    }

    @Test
    void aLongPauseCountsTheCapOnly() {
        String now = openAt(null, 3_600_000);
        service.claimGameplay("m");
        verify(store).claim(eq("m"), anyString(), eq(now), eq(300_000L));
        assertEquals(300_000L, service.capMs());
    }

    @Test
    void aSecondClaimOfTheSameRequestReusesTheFirst() {
        String now = openAt(null, 1_000);
        assertEquals(now, service.claimGameplay("m"));
        assertEquals(now, service.claimGameplay("m"));
        verify(store, times(1)).claim(any(), any(), any(), anyLong());
        verify(store, times(1)).findTsUpdate("m");
    }

    @Test
    void aMatchingIfMatchClaims() {
        RequestStamp.open("\"2026-10-22T10:00:00Z\"");
        when(store.findTsUpdate("m")).thenReturn(Optional.of("2026-10-22T10:00:00Z"));
        when(store.claim(eq("m"), eq("2026-10-22T10:00:00Z"), anyString(), anyLong())).thenReturn(true);
        assertNotNull(service.claimGameplay("m"));
    }

    @Test
    void aStaleIfMatchFailsFastWithoutWriting() {
        RequestStamp.open("2026-10-22T09:00:00Z");
        when(store.findTsUpdate("m")).thenReturn(Optional.of("2026-10-22T10:00:00Z"));
        StaleMatchException ex = assertThrows(StaleMatchException.class, () -> service.claimGameplay("m"));
        assertEquals("2026-10-22T10:00:00Z", ex.getCurrentVersion());
        assertEquals("m", ex.getMatchUuid());
        assertEquals(StaleMatchException.CODE, "STALE_MATCH");
        verify(store, never()).claim(any(), any(), any(), anyLong());
        verify(store, never()).stamp(any(), any(), anyLong());
        assertNull(RequestStamp.claimedVersion());
    }

    @Test
    void withoutTheHeaderALostRaceIsStaleWithTheWinnerVersion() {
        RequestStamp.open();
        when(store.findTsUpdate("m")).thenReturn(Optional.of("2026-10-22T10:00:00Z"),
                Optional.of("2026-10-22T10:00:01Z"));
        when(store.claim(any(), any(), any(), anyLong())).thenReturn(false);
        StaleMatchException ex = assertThrows(StaleMatchException.class, () -> service.claimGameplay("m"));
        assertEquals("2026-10-22T10:00:01Z", ex.getCurrentVersion());
        assertNull(RequestStamp.claimedVersion("m"));
    }

    @Test
    void aLostRaceOnAVanishedMatchHasNoVersion() {
        when(store.findTsUpdate("m")).thenReturn(Optional.of("2026-10-22T10:00:00Z"), Optional.empty());
        when(store.claim(any(), any(), any(), anyLong())).thenReturn(false);
        assertNull(assertThrows(StaleMatchException.class, () -> service.claimGameplay("m")).getCurrentVersion());
    }

    @Test
    void aClockTieStillMovesTheVersionForward() {
        RequestStamp.open();
        String future = Instant.parse(RequestStamp.now()).plusSeconds(5).toString();
        when(store.findTsUpdate("m")).thenReturn(Optional.of(future));
        when(store.claim(any(), any(), any(), anyLong())).thenReturn(true);
        String next = service.claimGameplay("m");
        assertTrue(Instant.parse(next).isAfter(Instant.parse(future)));
        assertEquals(Instant.parse(future).truncatedTo(java.time.temporal.ChronoUnit.MICROS).plusNanos(1_000), Instant.parse(next));
        verify(store).claim("m", future, next, 0L);
        assertEquals(next, RequestStamp.now());
    }

    @Test
    void outsideARequestEveryClaimIsIndependent() {
        when(store.findTsUpdate("m")).thenReturn(Optional.of("2026-10-22T10:00:00Z"));
        when(store.claim(any(), any(), any(), anyLong())).thenReturn(true);
        assertNotNull(service.claimGameplay("m"));
        service.claimGameplay("m");
        verify(store, times(2)).claim(any(), any(), any(), anyLong());
        assertNull(RequestStamp.claimedVersion());
    }

    @Test
    void nextVersionIsStrictlyGreater() {
        assertEquals("2026-10-22T10:00:01Z", MatchStampService.nextVersion("2026-10-22T10:00:00Z", "2026-10-22T10:00:01Z"));
        assertEquals("2026-10-22T10:00:00.000001Z",
                MatchStampService.nextVersion("2026-10-22T10:00:00Z", "2026-10-22T10:00:00Z"));
        assertEquals("2026-10-22T10:00:00.000002Z",
                MatchStampService.nextVersion("2026-10-22T10:00:00.000001500Z", "2026-10-22T09:00:00Z"));
        assertEquals("2026-10-22T10:00:01Z", MatchStampService.nextVersion("garbage", "2026-10-22T10:00:01Z"));
        assertEquals("2026-10-22T10:00:01Z", MatchStampService.nextVersion(null, "2026-10-22T10:00:01Z"));
        assertTrue(Instant.parse(MatchStampService.nextVersion("2026-10-22 10:00:00", "bad"))
                .isAfter(Instant.parse("2026-10-22T10:00:00Z")));
    }

    @Test
    void anAdminWriteStampsWithoutPlayTimeAndWithoutCheck() {
        RequestStamp.open("2000-01-01T00:00:00Z");
        when(store.findTsUpdate("m")).thenReturn(Optional.of("2026-10-22T10:00:00Z"));
        service.touchAdmin("m");
        verify(store).stamp(eq("m"), anyString(), eq(0L));
        verify(store, never()).claim(any(), any(), any(), anyLong());
    }

    @Test
    void anAdminWriteOnAnUnknownMatchStillStamps() {
        RequestStamp.open();
        when(store.findTsUpdate("m")).thenReturn(Optional.empty());
        service.touchAdmin("m");
        verify(store).stamp("m", RequestStamp.now(), 0L);
    }

    @Test
    void unknownOrBlankMatchesAreLeftAlone() {
        when(store.findTsUpdate("gone")).thenReturn(Optional.empty());
        assertNull(service.claimGameplay("gone"));
        assertNull(service.claimGameplay(null));
        assertNull(service.claimGameplay(" "));
        service.touchAdmin(null);
        service.touchAdmin(" ");
        verify(store, never()).claim(any(), any(), any(), anyLong());
        verify(store, never()).stamp(any(), any(), anyLong());
    }

    @Test
    void theCapFallsBackToTheDefault() {
        assertEquals(MatchStampService.DEFAULT_CAP_SECONDS * 1000, new MatchStampService(store, 0).capMs());
        assertEquals(60_000L, new MatchStampService(store, 60).capMs());
    }

    @Test
    void theDeltaReadsEveryStoredForm() {
        String now = "2026-10-22T10:00:10Z";
        assertEquals(10_000L, MatchStampService.playDelta("2026-10-22T10:00:00Z", now, 300_000));
        assertEquals(10_000L, MatchStampService.playDelta("2026-10-22 10:00:00", now, 300_000));
        assertEquals(9_500L, MatchStampService.playDelta("2026-10-22 10:00:00.5", now, 300_000));
        assertEquals(10_000L, MatchStampService.playDelta("2026-10-22 10:00:00.000000+00", now, 300_000));
        assertEquals(10_000L, MatchStampService.playDelta("2026-10-22T12:00:00+02:00", now, 300_000));
        assertEquals(0L, MatchStampService.playDelta("2026-10-22T10:00:20Z", now, 300_000));
        assertEquals(0L, MatchStampService.playDelta("garbage", now, 300_000));
        assertEquals(0L, MatchStampService.playDelta(null, now, 300_000));
        assertEquals(0L, MatchStampService.playDelta(" ", now, 300_000));
        assertEquals(0L, MatchStampService.playDelta(now, null, 300_000));
    }

    @Test
    void theOptionalPortHelpersSkipANullPort() {
        MatchStampPort port = mock(MatchStampPort.class);
        when(port.claimGameplay("m")).thenReturn("v");
        assertNull(MatchStampPort.claim(null, "m"));
        MatchStampPort.admin(null, "m");
        assertEquals("v", MatchStampPort.claim(port, "m"));
        MatchStampPort.admin(port, "m");
        verify(port).claimGameplay("m");
        verify(port).touchAdmin("m");
    }

    @Test
    void theClaimComparesAgainstTheVersionSeenByTheCheck() {
        RequestStamp.open();
        when(store.findTsUpdate("m")).thenReturn(Optional.of("2026-10-22T10:00:00Z"),
                Optional.of("2026-10-22T10:00:05Z"));
        assertEquals("2026-10-22T10:00:00Z", service.checkGameplay("m"));
        assertEquals("2026-10-22T10:00:00Z", service.checkGameplay("m"));
        assertEquals("2026-10-22T10:00:00Z", RequestStamp.seenVersion("m"));
        when(store.claim(any(), any(), any(), anyLong())).thenReturn(false);
        StaleMatchException ex = assertThrows(StaleMatchException.class, () -> service.claimGameplay("m"));
        verify(store).claim(eq("m"), eq("2026-10-22T10:00:00Z"), anyString(), anyLong());
        assertEquals("2026-10-22T10:00:05Z", ex.getCurrentVersion());
    }

    @Test
    void aCheckAfterTheClaimAnswersTheClaimedVersion() {
        String now = openAt(null, 1_000);
        String claimed = service.claimGameplay("m");
        assertEquals(now, claimed);
        assertEquals(claimed, service.checkGameplay("m"));
        verify(store, times(1)).findTsUpdate("m");
    }

    @Test
    void aStaleCheckWritesNothing() {
        RequestStamp.open("old");
        when(store.findTsUpdate("m")).thenReturn(Optional.of("new"));
        assertEquals("new", assertThrows(StaleMatchException.class, () -> service.checkGameplay("m"))
                .getCurrentVersion());
        assertNull(RequestStamp.seenVersion("m"));
        verify(store, never()).claim(any(), any(), any(), anyLong());
    }

    @Test
    void theCheckLeavesUnknownOrBlankMatchesAlone() {
        when(store.findTsUpdate("gone")).thenReturn(Optional.empty());
        assertNull(service.checkGameplay("gone"));
        assertNull(service.checkGameplay(null));
        assertNull(service.checkGameplay(""));
        MatchStampPort port = mock(MatchStampPort.class);
        when(port.checkGameplay("m")).thenReturn("v");
        assertEquals("v", MatchStampPort.check(port, "m"));
        assertNull(MatchStampPort.check(null, "m"));
    }

    @Test
    void isoUtcNormalizesEveryStoredForm() {
        assertEquals("2026-10-22T10:00:00Z", MatchStampService.isoUtc("2026-10-22 10:00:00"));
        assertEquals("2026-10-22T08:00:00Z", MatchStampService.isoUtc("2026-10-22T10:00:00+02:00"));
        assertEquals("2026-10-22T10:00:00.123456Z", MatchStampService.isoUtc("2026-10-22T10:00:00.123456Z"));
        assertNull(MatchStampService.isoUtc(null));
        assertEquals("nope", MatchStampService.isoUtc("nope"));
    }
}
