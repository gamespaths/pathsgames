package games.paths.core.entity.match;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Getter/setter and composite-key equals/hashCode coverage for the Step 24/25
 * turn-cycle and clock-history JPA entities.
 */
class TurnCycleEntitiesTest {

    @Test
    void gamingTurnQueueEntity_gettersAndSetters() {
        GamingTurnQueueEntity e = new GamingTurnQueueEntity();
        LocalDateTime now = LocalDateTime.now();
        e.setIdMatch(1L);
        e.setIdCharacterMatch(2L);
        e.setUuid("u");
        e.setClock(3);
        e.setTimestampStart(now);
        e.setTimestampEnd(now.plusHours(1));
        e.setPassCounter(4);
        e.setPriority(99L);
        e.setStatus("ACTIVE");
        e.setTsInsert("i");
        e.setTsUpdate("up");

        assertEquals(1L, e.getIdMatch());
        assertEquals(2L, e.getIdCharacterMatch());
        assertEquals("u", e.getUuid());
        assertEquals(3, e.getClock());
        assertEquals(now, e.getTimestampStart());
        assertEquals(now.plusHours(1), e.getTimestampEnd());
        assertEquals(4, e.getPassCounter());
        assertEquals(99L, e.getPriority());
        assertEquals("ACTIVE", e.getStatus());
        assertEquals("i", e.getTsInsert());
        assertEquals("up", e.getTsUpdate());
    }

    @Test
    void logClockHistoryEntity_gettersAndSetters() {
        LogClockHistoryEntity e = new LogClockHistoryEntity();
        e.setId(1L);
        e.setIdMatch(2L);
        e.setUuid("u");
        e.setClock(3);
        e.setWeather("rain");
        e.setTimestampStart("s");
        e.setTimestampEnd("e");
        e.setIdEventStart(10L);
        e.setIdEventEnd(11L);
        e.setTsInsert("i");
        e.setTsUpdate("up");

        assertEquals(1L, e.getId());
        assertEquals(2L, e.getIdMatch());
        assertEquals("u", e.getUuid());
        assertEquals(3, e.getClock());
        assertEquals("rain", e.getWeather());
        assertEquals("s", e.getTimestampStart());
        assertEquals("e", e.getTimestampEnd());
        assertEquals(10L, e.getIdEventStart());
        assertEquals(11L, e.getIdEventEnd());
        assertEquals("i", e.getTsInsert());
        assertEquals("up", e.getTsUpdate());
    }

    @Test
    void gamingTurnQueueEntityId_equalsHashCode() {
        GamingTurnQueueEntityId a = new GamingTurnQueueEntityId(1L, 2L);
        GamingTurnQueueEntityId b = new GamingTurnQueueEntityId(1L, 2L);
        GamingTurnQueueEntityId c = new GamingTurnQueueEntityId(1L, 9L);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
        assertEquals(a, a);
        assertNotEquals(a, null);
        assertNotEquals(a, "x");
        assertNotNull(new GamingTurnQueueEntityId());
    }

    @Test
    void logClockHistoryEntityId_equalsHashCode() {
        LogClockHistoryEntityId a = new LogClockHistoryEntityId(1L, 2L);
        LogClockHistoryEntityId b = new LogClockHistoryEntityId(1L, 2L);
        LogClockHistoryEntityId c = new LogClockHistoryEntityId(9L, 2L);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
        assertNotEquals(a, c);
        assertEquals(a, a);
        assertNotEquals(a, null);
        assertNotEquals(a, "x");
        a.setId(5L);
        a.setIdMatch(6L);
        assertEquals(5L, a.getId());
        assertEquals(6L, a.getIdMatch());

        // id same, idMatch different → not equal (covers the second branch)
        LogClockHistoryEntityId d = new LogClockHistoryEntityId(1L, 2L);
        LogClockHistoryEntityId e2 = new LogClockHistoryEntityId(1L, 99L);
        assertNotEquals(d, e2);
    }

    @Test
    void gamingTurnQueueEntity_prePersistAppliesDefaults() {
        GamingTurnQueueEntity e = new GamingTurnQueueEntity();
        e.onCreate();
        assertNotNull(e.getUuid());
        assertEquals(0, e.getClock());
        assertEquals(0, e.getPassCounter());
        assertEquals(0L, e.getPriority());
        assertEquals("WAITING", e.getStatus());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void gamingTurnQueueEntity_prePersistDoesNotOverwriteExisting() {
        GamingTurnQueueEntity e = new GamingTurnQueueEntity();
        e.setUuid("fixed-uuid");
        e.setClock(5);
        e.setPassCounter(2);
        e.setPriority(99L);
        e.setStatus("ACTIVE");
        e.setTsInsert("ts-in");
        e.setTsUpdate("ts-up");
        e.onCreate();
        assertEquals("fixed-uuid", e.getUuid());
        assertEquals(5, e.getClock());
        assertEquals(2, e.getPassCounter());
        assertEquals(99L, e.getPriority());
        assertEquals("ACTIVE", e.getStatus());
        assertEquals("ts-in", e.getTsInsert());
        assertEquals("ts-up", e.getTsUpdate());
    }

    @Test
    void gamingTurnQueueEntity_preUpdate_setsTimestamp() {
        GamingTurnQueueEntity e = new GamingTurnQueueEntity();
        e.onUpdate();
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void gamingTurnQueueEntityId_gettersAndSetters() {
        GamingTurnQueueEntityId id = new GamingTurnQueueEntityId(10L, 20L);
        assertEquals(10L, id.getIdMatch());
        assertEquals(20L, id.getIdCharacterMatch());
        id.setIdMatch(99L);
        id.setIdCharacterMatch(88L);
        assertEquals(99L, id.getIdMatch());
        assertEquals(88L, id.getIdCharacterMatch());
    }

    @Test
    void logClockHistoryEntity_prePersistAppliesDefaults() {
        LogClockHistoryEntity e = new LogClockHistoryEntity();
        e.onCreate();
        assertNotNull(e.getUuid());
        assertEquals(0, e.getClock());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void logClockHistoryEntity_prePersistDoesNotOverwriteExisting() {
        LogClockHistoryEntity e = new LogClockHistoryEntity();
        e.setUuid("fixed");
        e.setClock(3);
        e.setTsInsert("ins");
        e.setTsUpdate("upd");
        e.onCreate();
        assertEquals("fixed", e.getUuid());
        assertEquals(3, e.getClock());
        assertEquals("ins", e.getTsInsert());
        assertEquals("upd", e.getTsUpdate());
    }
}
