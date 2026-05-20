package games.paths.core.entity.match;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the match JPA entities, exercising getters, setters and
 * the {@code @PrePersist}/{@code @PreUpdate} hooks. Step 19.
 */
class MatchEntitiesTest {

    @Test
    void gamingMatchEntity_prePersistAppliesDefaults() {
        GamingMatchEntity e = new GamingMatchEntity();
        e.onCreate();
        assertNotNull(e.getUuid());
        assertEquals("CREATED", e.getStatus());
        assertEquals(0, e.getCurrentClock());
        assertEquals(5, e.getExpCost());
        assertEquals(0, e.getSecureLocationParam());
        assertEquals(0, e.getCounterConsecutivePass());
        assertEquals(1, e.getSinglePlayer());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());

        // Calling again must not overwrite already-populated fields
        String uuid = e.getUuid();
        e.onCreate();
        assertEquals(uuid, e.getUuid());

        e.onUpdate();
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void gamingMatchEntity_settersRoundtrip() {
        GamingMatchEntity e = new GamingMatchEntity();
        e.setId(1L);
        e.setUuid("uuid");
        e.setIdStory(2L);
        e.setName("test");
        e.setIdDifficulty(3L);
        e.setExpCost(7);
        e.setStatus("RUNNING");
        e.setCurrentClock(10);
        e.setIdCurrentWeather(4L);
        e.setIdUserCreator(5L);
        e.setTimestampStart("ts1");
        e.setTimestampLockExpiration("ts2");
        e.setTimestampGameover("ts3");
        e.setTimestampEnd("ts4");
        e.setIdCharacterCurrentTurn(6L);
        e.setSecureLocationParam(1);
        e.setCounterConsecutivePass(2);
        e.setSinglePlayer(0);
        e.setCharacterTemplateUuid("ct");
        e.setClassUuid("cl");
        e.setTraitUuids("t1,t2");
        e.setTsInsert("ins");
        e.setTsUpdate("upd");

        assertEquals(1L, e.getId());
        assertEquals("uuid", e.getUuid());
        assertEquals(2L, e.getIdStory());
        assertEquals("test", e.getName());
        assertEquals(3L, e.getIdDifficulty());
        assertEquals(7, e.getExpCost());
        assertEquals("RUNNING", e.getStatus());
        assertEquals(10, e.getCurrentClock());
        assertEquals(4L, e.getIdCurrentWeather());
        assertEquals(5L, e.getIdUserCreator());
        assertEquals("ts1", e.getTimestampStart());
        assertEquals("ts2", e.getTimestampLockExpiration());
        assertEquals("ts3", e.getTimestampGameover());
        assertEquals("ts4", e.getTimestampEnd());
        assertEquals(6L, e.getIdCharacterCurrentTurn());
        assertEquals(1, e.getSecureLocationParam());
        assertEquals(2, e.getCounterConsecutivePass());
        assertEquals(0, e.getSinglePlayer());
        assertEquals("ct", e.getCharacterTemplateUuid());
        assertEquals("cl", e.getClassUuid());
        assertEquals("t1,t2", e.getTraitUuids());
        assertEquals("ins", e.getTsInsert());
        assertEquals("upd", e.getTsUpdate());
    }

    @Test
    void gamingStateLocationsEntity_prePersist() {
        GamingStateLocationsEntity e = new GamingStateLocationsEntity();
        e.onCreate();
        assertNotNull(e.getUuid());
        assertEquals(0, e.getFlagAlreadyActived());
        assertEquals(0, e.getClockCounter());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
        e.onUpdate();
        assertNotNull(e.getTsUpdate());

        String uuid = e.getUuid();
        e.onCreate();
        assertEquals(uuid, e.getUuid());
    }

    @Test
    void gamingStateLocationsEntity_setters() {
        GamingStateLocationsEntity e = new GamingStateLocationsEntity();
        e.setIdMatch(1L);
        e.setIdLocation(2L);
        e.setUuid("u");
        e.setFlagAlreadyActived(1);
        e.setClockCounter(5);
        e.setTsInsert("i");
        e.setTsUpdate("u2");
        assertEquals(1L, e.getIdMatch());
        assertEquals(2L, e.getIdLocation());
        assertEquals("u", e.getUuid());
        assertEquals(1, e.getFlagAlreadyActived());
        assertEquals(5, e.getClockCounter());
        assertEquals("i", e.getTsInsert());
        assertEquals("u2", e.getTsUpdate());
    }

    @Test
    void gamingStateLocationsEntityId_equalsHashcode() {
        GamingStateLocationsEntityId a = new GamingStateLocationsEntityId(1L, 2L);
        GamingStateLocationsEntityId b = new GamingStateLocationsEntityId(1L, 2L);
        GamingStateLocationsEntityId c = new GamingStateLocationsEntityId(1L, 3L);
        GamingStateLocationsEntityId empty = new GamingStateLocationsEntityId();

        assertEquals(a, a);
        assertEquals(a, b);
        assertNotEquals(a, c);
        assertNotEquals(a, "string");
        assertNotEquals(a, null);
        assertEquals(a.hashCode(), b.hashCode());
        assertEquals(1L, a.getIdMatch());
        assertEquals(2L, a.getIdLocation());
        empty.setIdMatch(9L);
        empty.setIdLocation(8L);
        assertEquals(9L, empty.getIdMatch());
        assertEquals(8L, empty.getIdLocation());
    }

    @Test
    void gamingStateRegistryEntity_prePersist() {
        GamingStateRegistryEntity e = new GamingStateRegistryEntity();
        e.onCreate();
        assertNotNull(e.getUuid());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
        e.onUpdate();
        assertNotNull(e.getTsUpdate());

        String uuid = e.getUuid();
        e.onCreate();
        assertEquals(uuid, e.getUuid());
    }

    @Test
    void gamingStateRegistryEntity_setters() {
        GamingStateRegistryEntity e = new GamingStateRegistryEntity();
        e.setId(1L);
        e.setIdMatch(2L);
        e.setUuid("u");
        e.setKey("k");
        e.setStringValue("v");
        e.setIntValue(7);
        e.setIdCharacter(3L);
        e.setIdEvent(4L);
        e.setIdChoice(5L);
        e.setClock(8);
        e.setIdMission(9L);
        e.setIdMissionSteps(10L);
        e.setTsInsert("i");
        e.setTsUpdate("u2");
        assertEquals(1L, e.getId());
        assertEquals(2L, e.getIdMatch());
        assertEquals("u", e.getUuid());
        assertEquals("k", e.getKey());
        assertEquals("v", e.getStringValue());
        assertEquals(7, e.getIntValue());
        assertEquals(3L, e.getIdCharacter());
        assertEquals(4L, e.getIdEvent());
        assertEquals(5L, e.getIdChoice());
        assertEquals(8, e.getClock());
        assertEquals(9L, e.getIdMission());
        assertEquals(10L, e.getIdMissionSteps());
        assertEquals("i", e.getTsInsert());
        assertEquals("u2", e.getTsUpdate());
    }

    @Test
    void gamingStateRegistryEntityId_equalsHashcode() {
        GamingStateRegistryEntityId a = new GamingStateRegistryEntityId(1L, 2L);
        GamingStateRegistryEntityId b = new GamingStateRegistryEntityId(1L, 2L);
        GamingStateRegistryEntityId c = new GamingStateRegistryEntityId(2L, 3L);
        GamingStateRegistryEntityId empty = new GamingStateRegistryEntityId();
        empty.setId(11L);
        empty.setIdMatch(12L);

        assertEquals(a, a);
        assertEquals(a, b);
        assertNotEquals(a, c);
        assertNotEquals(a, "x");
        assertNotEquals(a, null);
        assertEquals(a.hashCode(), b.hashCode());
        assertEquals(1L, a.getId());
        assertEquals(2L, a.getIdMatch());
        assertEquals(11L, empty.getId());
        assertEquals(12L, empty.getIdMatch());
    }
}
