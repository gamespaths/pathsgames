package games.paths.adapters.rest.dto;

import games.paths.core.port.match.TurnCyclePort;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the Step 24 turn-cycle projections: {@link PassTurnResponse},
 * {@link TurnQueueEntryResponse} and {@link TurnSequenceResponse}.
 */
class TurnCycleDtosTest {

    private TurnCyclePort.TurnEntry entry(String uuid, String status) {
        return new TurnCyclePort.TurnEntry(uuid, 7L, "Ranger", 42L, 3, status, 2,
                "2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z");
    }

    @Test
    void passTurnResponse_fromModel_mapsAllFields() {
        PassTurnResponse r = PassTurnResponse.fromModel(
                new TurnCyclePort.PassResult("m1", "char-a", "char-b", "RUNNING"));

        assertEquals("m1", r.getMatchUuid());
        assertEquals("char-a", r.getPassedCharacterUuid());
        assertEquals("char-b", r.getNextActiveCharacterUuid());
        assertEquals("RUNNING", r.getStatus());
    }

    @Test
    void passTurnResponse_fromModel_keepsNullNextActiveCharacter() {
        PassTurnResponse r = PassTurnResponse.fromModel(
                new TurnCyclePort.PassResult("m1", "char-a", null, "ENDED"));

        assertNull(r.getNextActiveCharacterUuid());
        assertEquals("ENDED", r.getStatus());
    }

    @Test
    void turnQueueEntryResponse_fromModel_mapsAllFields() {
        TurnQueueEntryResponse r = TurnQueueEntryResponse.fromModel(entry("char-a", "ACTIVE"));

        assertEquals("char-a", r.getCharacterUuid());
        assertEquals(7L, r.getIdCharacter());
        assertEquals("Ranger", r.getName());
        assertEquals(42L, r.getPriority());
        assertEquals(3, r.getClock());
        assertEquals("ACTIVE", r.getStatus());
        assertEquals(2, r.getPassCounter());
        assertEquals("2026-01-01T10:00:00Z", r.getTimestampStart());
        assertEquals("2026-01-01T11:00:00Z", r.getTimestampEnd());
    }

    @Test
    void turnSequenceResponse_fromModel_mapsQueueInOrder() {
        TurnSequenceResponse r = TurnSequenceResponse.fromModel(
                new TurnCyclePort.TurnSequenceResult("m1", 5, "RUNNING", "char-a",
                        List.of(entry("char-a", "ACTIVE"), entry("char-b", "WAITING"))));

        assertEquals("m1", r.getMatchUuid());
        assertEquals(5, r.getCurrentClock());
        assertEquals("RUNNING", r.getStatus());
        assertEquals("char-a", r.getActiveCharacterUuid());
        assertEquals(2, r.getQueue().size());
        assertEquals("char-a", r.getQueue().get(0).getCharacterUuid());
        assertEquals("ACTIVE", r.getQueue().get(0).getStatus());
        assertEquals("char-b", r.getQueue().get(1).getCharacterUuid());
        assertEquals("WAITING", r.getQueue().get(1).getStatus());
    }

    @Test
    void turnSequenceResponse_fromModel_emptyQueue() {
        TurnSequenceResponse r = TurnSequenceResponse.fromModel(
                new TurnCyclePort.TurnSequenceResult("m1", 0, "CREATED", null, List.of()));

        assertNull(r.getActiveCharacterUuid());
        assertTrue(r.getQueue().isEmpty());
    }
}
