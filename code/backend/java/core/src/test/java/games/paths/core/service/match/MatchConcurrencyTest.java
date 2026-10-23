package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.RequestStamp;
import games.paths.core.model.match.StaleMatchException;
import games.paths.core.model.match.TurnStatuses;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.match.MatchStampStorePort;
import games.paths.core.port.match.TurnCyclePort;
import games.paths.core.port.match.TurnCycleStorePort;
import games.paths.core.port.match.TurnCycleStorePort.CharacterTurnView;
import games.paths.core.port.match.TurnCycleStorePort.MatchView;
import games.paths.core.port.match.TurnCycleStorePort.QueueRow;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** v1.7.0 step 8 a gameplay command with the real stamp service: check first, claim before the first write. */
class MatchConcurrencyTest {

    private static final String MATCH = "match-uuid";
    private static final String USER = "user-uuid";
    private static final String V1 = "2026-10-22T10:00:00Z";
    private static final String V2 = "2026-10-22T10:00:07Z";

    private final MatchStampStorePort stampStore = mock(MatchStampStorePort.class);
    private final TurnCycleStorePort store = mock(TurnCycleStorePort.class);
    private final UserAccessPort users = mock(UserAccessPort.class);
    private TurnCycleService service;

    @BeforeEach
    void setUp() {
        service = new TurnCycleService(store, users);
        service.setMatchStamp(new MatchStampService(stampStore, 300));
        when(users.findByUuid(USER)).thenReturn(Optional.of(new UserAccessPort.UserView(7L, USER, "u", "PLAYER", 2)));
        when(stampStore.findTsUpdate(MATCH)).thenReturn(Optional.of(V1));
    }

    @AfterEach
    void close() {
        RequestStamp.close();
    }

    private void running(long idActiveUser) {
        when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(new MatchView(1L, MATCH, MatchStatuses.RUNNING, 0, 7L, 10L)));
        when(store.findCharactersByMatchId(1L)).thenReturn(List.of(
                new CharacterTurnView(10L, "c10", idActiveUser, 5, 5, 5, 10, 10, false),
                new CharacterTurnView(20L, "c20", 7L, 4, 4, 4, 10, 10, false)));
        when(store.findQueueByMatchId(1L)).thenReturn(List.of(
                new QueueRow(10L, "q10", 0, 9, TurnStatuses.ACTIVE, 0, null, null),
                new QueueRow(20L, "q20", 0, 1, TurnStatuses.WAITING, 0, null, null)));
    }

    @Test
    void theClaimRunsBeforeTheFirstWriteAndBecomesTheVersion() {
        RequestStamp.open(V1);
        running(7L);
        when(stampStore.claim(eq(MATCH), eq(V1), anyString(), anyLong())).thenReturn(true);
        service.passTurn(MATCH, USER);
        InOrder order = inOrder(stampStore, store);
        order.verify(stampStore).claim(eq(MATCH), eq(V1), anyString(), anyLong());
        order.verify(store, atLeastOnce()).saveQueueRow(eq(1L), any());
        assertNotNull(RequestStamp.claimedVersion());
        assertNotEquals(V1, RequestStamp.claimedVersion());
    }

    @Test
    void aStaleHeaderWinsOverTheDomainRefusalAndWritesNothing() {
        RequestStamp.open("2026-10-22T09:00:00Z");
        running(99L);
        StaleMatchException ex = assertThrows(StaleMatchException.class, () -> service.passTurn(MATCH, USER));
        assertEquals(V1, ex.getCurrentVersion());
        verify(stampStore, never()).claim(any(), any(), any(), anyLong());
        verify(store, never()).saveQueueRow(anyLong(), any());
    }

    @Test
    void aDomainRefusalWithAFreshHeaderLeavesTheVersionAlone() {
        RequestStamp.open(V1);
        running(99L);
        TurnCyclePort.TurnCycleException ex = assertThrows(TurnCyclePort.TurnCycleException.class,
                () -> service.passTurn(MATCH, USER));
        assertEquals(TurnCyclePort.TurnCycleException.Code.NOT_YOUR_TURN, ex.getCode());
        verify(stampStore, never()).claim(any(), any(), any(), anyLong());
    }

    @Test
    void theTerminalStateWinsOverStale() {
        RequestStamp.open("2026-10-22T09:00:00Z");
        when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(new MatchView(1L, MATCH, MatchStatuses.ENDED, 0, 7L, null)));
        TurnCyclePort.TurnCycleException ex = assertThrows(TurnCyclePort.TurnCycleException.class,
                () -> service.passTurn(MATCH, USER));
        assertEquals(TurnCyclePort.TurnCycleException.Code.MATCH_NOT_RUNNING, ex.getCode());
        verify(stampStore, never()).findTsUpdate(any());
    }

    @Test
    void withoutTheHeaderALostRaceIsStaleBeforeAnyWrite() {
        RequestStamp.open();
        running(7L);
        when(stampStore.findTsUpdate(MATCH)).thenReturn(Optional.of(V1), Optional.of(V2));
        when(stampStore.claim(any(), any(), any(), anyLong())).thenReturn(false);
        StaleMatchException ex = assertThrows(StaleMatchException.class, () -> service.passTurn(MATCH, USER));
        assertEquals(V2, ex.getCurrentVersion());
        verify(store, never()).saveQueueRow(anyLong(), any());
        verify(store, never()).updateMatchStatusAndTurn(anyLong(), any(), any());
    }
}
