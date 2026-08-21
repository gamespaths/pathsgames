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

        //assertEquals(a, a); --> assertThat(obj).isEqualTo(obj); // Compliant
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
    void logEventsEntity_prePersistAppliesDefaults() {
        LogEventsEntity e = new LogEventsEntity();
        e.onCreate();
        assertNotNull(e.getUuid());
        assertNotNull(e.getTimestamp());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());

        // Second call must not overwrite already-set uuid/timestamp
        String uuid = e.getUuid();
        String ts = e.getTimestamp();
        e.onCreate();
        assertEquals(uuid, e.getUuid());
        assertEquals(ts, e.getTimestamp());

        e.onUpdate();
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void logEventsEntity_settersRoundtrip() {
        LogEventsEntity e = new LogEventsEntity();
        e.setId(1L);
        e.setIdMatch(2L);
        e.setUuid("ev-uuid");
        e.setIdCharacterMatch(3L);
        e.setTimestamp("2025-01-01T00:00:00Z");
        e.setIdEvent(4L);
        e.setIdChoise(5L);
        e.setLogMessage("msg");
        e.setTsInsert("ins");
        e.setTsUpdate("upd");

        assertEquals(1L, e.getId());
        assertEquals(2L, e.getIdMatch());
        assertEquals("ev-uuid", e.getUuid());
        assertEquals(3L, e.getIdCharacterMatch());
        assertEquals("2025-01-01T00:00:00Z", e.getTimestamp());
        assertEquals(4L, e.getIdEvent());
        assertEquals(5L, e.getIdChoise());
        assertEquals("msg", e.getLogMessage());
        assertEquals("ins", e.getTsInsert());
        assertEquals("upd", e.getTsUpdate());
    }

    @Test
    void logEventsEntityId_equalsHashcode() {
        LogEventsEntityId a = new LogEventsEntityId(1L, 2L);
        LogEventsEntityId b = new LogEventsEntityId(1L, 2L);
        LogEventsEntityId c = new LogEventsEntityId(3L, 4L);
        LogEventsEntityId empty = new LogEventsEntityId();
        empty.setId(9L);
        empty.setIdMatch(10L);

        //assertEquals(a, a); --> assertThat(obj).isEqualTo(obj); // Compliant
        assertEquals(a, b);
        assertNotEquals(a, c);
        assertNotEquals(a, "x");
        assertNotEquals(a, null);
        assertEquals(a.hashCode(), b.hashCode());
        assertEquals(1L, a.getId());
        assertEquals(2L, a.getIdMatch());
        assertEquals(9L, empty.getId());
        assertEquals(10L, empty.getIdMatch());
    }

    @Test
    void gamingCharacterInstanceEntity_prePersistAppliesDefaults() {
        GamingCharacterInstanceEntity e = new GamingCharacterInstanceEntity();
        e.onCreate();
        assertNotNull(e.getUuid());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
        assertEquals(1, e.getDexterity());
        assertEquals(1, e.getIntelligence());
        assertEquals(1, e.getConstitution());
        assertEquals(0, e.getEnergy());
        assertEquals(1, e.getLife());
        assertEquals(0, e.getSad());
        assertEquals(0, e.getLifeMax());
        assertEquals(0, e.getEnergyMax());
        assertEquals(0, e.getSadMax());
        assertEquals(0, e.getWeightMax());
        assertFalse(e.getIsSleeping());
        assertFalse(e.getIsComa());
        assertEquals(0, e.getClockInComa());
        assertEquals(0, e.getCounterConsecutivePass());

        e.onUpdate();
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void gamingCharacterInstanceEntity_settersRoundtrip() {
        GamingCharacterInstanceEntity e = new GamingCharacterInstanceEntity();
        e.setIdUser(1L);
        e.setIdCharacterTemplate(2L);
        e.setIdClass(3L);
        e.setDexterity(10);
        e.setIntelligence(11);
        e.setConstitution(12);
        e.setEnergy(50);
        e.setLife(100);
        e.setSad(2);
        e.setLifeMax(120);
        e.setEnergyMax(60);
        e.setSadMax(8);
        e.setWeightMax(24);
        e.setIdLocation(99L);
        e.setIsSleeping(true);
        e.setIsComa(false);
        e.setClockInComa(3);
        e.setTimestampLastPass("2025-01-01");
        e.setCounterConsecutivePass(1);

        assertEquals(1L, e.getIdUser());
        assertEquals(2L, e.getIdCharacterTemplate());
        assertEquals(3L, e.getIdClass());
        assertEquals(10, e.getDexterity());
        assertEquals(11, e.getIntelligence());
        assertEquals(12, e.getConstitution());
        assertEquals(50, e.getEnergy());
        assertEquals(100, e.getLife());
        assertEquals(2, e.getSad());
        assertEquals(120, e.getLifeMax());
        assertEquals(60, e.getEnergyMax());
        assertEquals(8, e.getSadMax());
        assertEquals(24, e.getWeightMax());
        assertEquals(99L, e.getIdLocation());
        assertTrue(e.getIsSleeping());
        assertFalse(e.getIsComa());
        assertEquals(3, e.getClockInComa());
        assertEquals("2025-01-01", e.getTimestampLastPass());
        assertEquals(1, e.getCounterConsecutivePass());
    }

    @Test
    void gamingStateRegistryEntityId_equalsHashcode() {
        GamingStateRegistryEntityId a = new GamingStateRegistryEntityId(1L, 2L);
        GamingStateRegistryEntityId b = new GamingStateRegistryEntityId(1L, 2L);
        GamingStateRegistryEntityId c = new GamingStateRegistryEntityId(2L, 3L);
        GamingStateRegistryEntityId empty = new GamingStateRegistryEntityId();
        empty.setId(11L);
        empty.setIdMatch(12L);

        //assertEquals(a, a); --> assertThat(obj).isEqualTo(obj); // Compliant
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

    @Test
    void gamingInventoryItemsEntity_prePersistAppliesDefaults() {
        GamingInventoryItemsEntity e = new GamingInventoryItemsEntity();
        e.onCreate();
        assertNotNull(e.getUuid());
        assertEquals(1, e.getAmount());
        assertEquals("ACTIVE", e.getState());
    }

    @Test
    void gamingInventoryItemsEntity_settersRoundtrip() {
        GamingInventoryItemsEntity e = new GamingInventoryItemsEntity();
        e.setIdCharacterMatch(1L);
        e.setIdItem(2L);
        e.setAmount(3);
        e.setState("USED");

        assertEquals(1L, e.getIdCharacterMatch());
        assertEquals(2L, e.getIdItem());
        assertEquals(3, e.getAmount());
        assertEquals("USED", e.getState());
    }

    @Test
    void gamingInventoryItemsEntity_preUpdateDoesNotThrow() {
        GamingInventoryItemsEntity e = new GamingInventoryItemsEntity();
        e.onCreate();
        String tsInsert = e.getTsInsert();
        e.onUpdate();
        // tsUpdate should now be set (may equal tsInsert if same millisecond)
        assertNotNull(e.getTsUpdate());
        assertNotNull(tsInsert);
    }

    @Test
    void gamingInventoryItemsEntityId_equalsHashcode() {
        GamingInventoryItemsEntityId a = new GamingInventoryItemsEntityId(1L, 2L);
        GamingInventoryItemsEntityId b = new GamingInventoryItemsEntityId(1L, 2L);
        GamingInventoryItemsEntityId c = new GamingInventoryItemsEntityId(3L, 4L);
        GamingInventoryItemsEntityId empty = new GamingInventoryItemsEntityId();

        assertEquals(a, b);
        assertNotEquals(a, c);
        assertNotEquals(a, null);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void gamingCharacterTraitsEntity_gettersAndSetters() {
        GamingCharacterTraitsEntity e = new GamingCharacterTraitsEntity();
        e.setIdCharacterMatch(1L);
        e.setIdTraits(2L);
        e.setIdEvent(3L);

        assertEquals(1L, e.getIdCharacterMatch());
        assertEquals(2L, e.getIdTraits());
        assertEquals(3L, e.getIdEvent());
    }

    @Test
    void gamingCharacterTraitsEntityId_equalsHashcode() {
        GamingCharacterTraitsEntityId a = new GamingCharacterTraitsEntityId(1L, 2L);
        GamingCharacterTraitsEntityId b = new GamingCharacterTraitsEntityId(1L, 2L);
        GamingCharacterTraitsEntityId c = new GamingCharacterTraitsEntityId(3L, 4L);
        GamingCharacterTraitsEntityId empty = new GamingCharacterTraitsEntityId();

        assertEquals(a, b);
        assertNotEquals(a, c);
        assertNotEquals(a, null);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
