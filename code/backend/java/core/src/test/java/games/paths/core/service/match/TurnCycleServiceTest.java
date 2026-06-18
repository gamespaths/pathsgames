package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.TurnStatuses;
import games.paths.core.port.match.TurnCyclePort;
import games.paths.core.port.match.TurnCyclePort.TurnCycleException;
import games.paths.core.port.match.TurnCycleStorePort;
import games.paths.core.port.match.TurnCycleStorePort.CharacterTurnView;
import games.paths.core.port.match.TurnCycleStorePort.MatchView;
import games.paths.core.port.match.TurnCycleStorePort.QueueRow;
import games.paths.core.port.match.UserAccessPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@DisplayName("TurnCycleService")
class TurnCycleServiceTest {

    private TurnCycleStorePort store;
    private UserAccessPort userAccessPort;
    private TurnCycleService service;

    private static final String MATCH = "match-uuid";
    private static final String USER = "user-uuid";
    private static final long USER_ID = 7L;

    @BeforeEach
    void setUp() {
        store = mock(TurnCycleStorePort.class);
        userAccessPort = mock(UserAccessPort.class);
        service = new TurnCycleService(store, userAccessPort);
        when(userAccessPort.findByUuid(USER)).thenReturn(
                Optional.of(new UserAccessPort.UserView(USER_ID, USER, "u", "PLAYER", 2)));
    }

    private MatchView match(String status, Long currentTurn) {
        return new MatchView(1L, MATCH, status, 0, USER_ID, currentTurn);
    }

    private CharacterTurnView character(long id, String uuid, int dex, int intel, int cos, int life) {
        return new CharacterTurnView(id, uuid, USER_ID, dex, intel, cos, life, 10, false);
    }

    @Nested
    @DisplayName("startMatch")
    class StartMatch {

        @Test
        @DisplayName("builds the queue ordered by priority and activates the top character")
        void success() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.CREATED, null)));
            CharacterTurnView strong = character(10L, "char-strong", 10, 10, 10, 50);
            CharacterTurnView weak = character(20L, "char-weak", 1, 1, 1, 5);
            when(store.findCharactersByMatchId(1L)).thenReturn(List.of(weak, strong));

            TurnCyclePort.TurnSequenceResult result = service.startMatch(MATCH, USER);

            assertEquals(MatchStatuses.RUNNING, result.status());
            assertEquals("char-strong", result.activeCharacterUuid());
            assertEquals("char-strong", result.queue().get(0).characterUuid());
            assertEquals(TurnStatuses.ACTIVE, result.queue().get(0).status());
            assertEquals(TurnStatuses.WAITING, result.queue().get(1).status());

            verify(store).replaceQueue(eq(1L), anyList());
            verify(store).updateMatchStatusAndTurn(1L, MatchStatuses.RUNNING, 10L);
        }

        @Test
        @DisplayName("MATCH_NOT_FOUND when caller is not the creator")
        void notOwner() {
            when(store.findMatchByUuid(MATCH)).thenReturn(
                    Optional.of(new MatchView(1L, MATCH, MatchStatuses.CREATED, 0, 999L, null)));
            assertCode(TurnCycleException.Code.MATCH_NOT_FOUND, () -> service.startMatch(MATCH, USER));
        }

        @Test
        @DisplayName("MATCH_NOT_STARTABLE when not in CREATED")
        void notStartable() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, null)));
            assertCode(TurnCycleException.Code.MATCH_NOT_STARTABLE, () -> service.startMatch(MATCH, USER));
        }

        @Test
        @DisplayName("NO_CHARACTERS_JOINED when no character joined")
        void noCharacters() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.CREATED, null)));
            when(store.findCharactersByMatchId(1L)).thenReturn(List.of());
            assertCode(TurnCycleException.Code.NO_CHARACTERS_JOINED, () -> service.startMatch(MATCH, USER));
        }
    }

    @Nested
    @DisplayName("passTurn")
    class PassTurn {

        @Test
        @DisplayName("completes the active turn and activates the next in queue")
        void success() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 10L)));
            when(store.findCharactersByMatchId(1L)).thenReturn(List.of(
                    character(10L, "char-a", 10, 10, 10, 50),
                    character(20L, "char-b", 5, 5, 5, 20)));
            when(store.findQueueByMatchId(1L)).thenReturn(List.of(
                    new QueueRow(10L, "q-a", 0, 73201L, TurnStatuses.ACTIVE, 0, null, null),
                    new QueueRow(20L, "q-b", 0, 30201L, TurnStatuses.WAITING, 0, null, null)));

            TurnCyclePort.PassResult result = service.passTurn(MATCH, USER);

            assertEquals("char-a", result.passedCharacterUuid());
            assertEquals("char-b", result.nextActiveCharacterUuid());
            assertEquals(MatchStatuses.RUNNING, result.status());

            ArgumentCaptor<QueueRow> rowCaptor = ArgumentCaptor.forClass(QueueRow.class);
            verify(store, atLeastOnce()).saveQueueRow(eq(1L), rowCaptor.capture());
            assertTrue(rowCaptor.getAllValues().stream()
                    .anyMatch(r -> r.idCharacterMatch() == 10L && TurnStatuses.COMPLETED.equals(r.status())
                            && r.passCounter() == 1));
            verify(store).updateMatchStatusAndTurn(1L, MatchStatuses.RUNNING, 20L);
        }

        @Test
        @DisplayName("single character: pass starts a new round re-activating the same character")
        void singleCharacterLoops() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 10L)));
            when(store.findCharactersByMatchId(1L)).thenReturn(List.of(character(10L, "char-a", 5, 5, 5, 10)));
            when(store.findQueueByMatchId(1L)).thenReturn(List.of(
                    new QueueRow(10L, "q-a", 0, 30201L, TurnStatuses.ACTIVE, 0, null, null)));

            TurnCyclePort.PassResult result = service.passTurn(MATCH, USER);
            assertEquals("char-a", result.passedCharacterUuid());
            assertEquals("char-a", result.nextActiveCharacterUuid());
        }

        @Test
        @DisplayName("MATCH_NOT_RUNNING when match is not RUNNING")
        void notRunning() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.CREATED, null)));
            assertCode(TurnCycleException.Code.MATCH_NOT_RUNNING, () -> service.passTurn(MATCH, USER));
        }

        @Test
        @DisplayName("NOT_YOUR_TURN when the active character belongs to another user")
        void notYourTurn() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 10L)));
            CharacterTurnView other = new CharacterTurnView(10L, "char-a", 999L, 5, 5, 5, 10, 10, false);
            when(store.findCharactersByMatchId(1L)).thenReturn(List.of(other));
            when(store.findQueueByMatchId(1L)).thenReturn(List.of(
                    new QueueRow(10L, "q-a", 0, 30201L, TurnStatuses.ACTIVE, 0, null, null)));
            assertCode(TurnCycleException.Code.NOT_YOUR_TURN, () -> service.passTurn(MATCH, USER));
        }
    }

    @Nested
    @DisplayName("getTurnSequence")
    class GetTurnSequence {

        @Test
        @DisplayName("returns the queue ordered by priority with the active character")
        void ordered() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match(MatchStatuses.RUNNING, 10L)));
            when(store.findCharactersByMatchId(1L)).thenReturn(List.of(
                    character(10L, "char-a", 10, 10, 10, 50),
                    character(20L, "char-b", 5, 5, 5, 20)));
            when(store.findQueueByMatchId(1L)).thenReturn(List.of(
                    new QueueRow(20L, "q-b", 0, 30201L, TurnStatuses.WAITING, 0, null, null),
                    new QueueRow(10L, "q-a", 0, 73201L, TurnStatuses.ACTIVE, 0, null, null)));

            TurnCyclePort.TurnSequenceResult result = service.getTurnSequence(MATCH, USER);
            assertEquals("char-a", result.activeCharacterUuid());
            assertEquals("char-a", result.queue().get(0).characterUuid());
            assertEquals("char-b", result.queue().get(1).characterUuid());
        }

        @Test
        @DisplayName("MATCH_NOT_FOUND when match does not exist")
        void notFound() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.empty());
            assertCode(TurnCycleException.Code.MATCH_NOT_FOUND, () -> service.getTurnSequence(MATCH, USER));
        }
    }

    private static void assertCode(TurnCycleException.Code expected, Runnable action) {
        TurnCycleException ex = assertThrows(TurnCycleException.class, action::run);
        assertEquals(expected, ex.getCode());
    }
}
