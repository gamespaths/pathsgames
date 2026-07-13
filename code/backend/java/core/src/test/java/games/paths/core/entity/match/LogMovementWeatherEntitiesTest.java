package games.paths.core.entity.match;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the Step 27 / Step 28 log entities and their composite ids:
 * {@link LogWeatherEntity}, {@link LogWeatherEntityId}, {@link LogMovementEntity}
 * and {@link LogMovementEntityId}.
 */
class LogMovementWeatherEntitiesTest {

    /** {@code @PrePersist} is protected — invoke it the way the JPA provider does. */
    private static void prePersist(Object entity) throws Exception {
        Method m = entity.getClass().getDeclaredMethod("onCreate");
        m.setAccessible(true);
        m.invoke(entity);
    }

    // ── LogMovementEntity ────────────────────────────────────────────────────

    @Test
    void logMovementEntity_gettersAndSetters() {
        LogMovementEntity e = new LogMovementEntity();
        e.setId(5L);
        e.setIdMatch(3L);
        e.setUuid("mov-uuid");
        e.setIdCharacterMatch(11L);
        e.setIdLocationFrom(1L);
        e.setIdLocationTo(2L);
        e.setEnergy(7);
        e.setTsInsert("2026-01-01T00:00:00Z");
        e.setTsUpdate("2026-01-02T00:00:00Z");

        assertEquals(5L, e.getId());
        assertEquals(3L, e.getIdMatch());
        assertEquals("mov-uuid", e.getUuid());
        assertEquals(11L, e.getIdCharacterMatch());
        assertEquals(1L, e.getIdLocationFrom());
        assertEquals(2L, e.getIdLocationTo());
        assertEquals(7, e.getEnergy());
        assertEquals("2026-01-01T00:00:00Z", e.getTsInsert());
        assertEquals("2026-01-02T00:00:00Z", e.getTsUpdate());
    }

    @Test
    void logMovementEntity_prePersistAppliesDefaults() throws Exception {
        LogMovementEntity e = new LogMovementEntity();
        prePersist(e);

        assertNotNull(e.getUuid());
        assertEquals(0, e.getEnergy());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void logMovementEntity_prePersistDoesNotOverwriteExisting() throws Exception {
        LogMovementEntity e = new LogMovementEntity();
        e.setUuid("kept");
        e.setEnergy(9);
        e.setTsInsert("ts-in");
        e.setTsUpdate("ts-up");
        prePersist(e);

        assertEquals("kept", e.getUuid());
        assertEquals(9, e.getEnergy());
        assertEquals("ts-in", e.getTsInsert());
        assertEquals("ts-up", e.getTsUpdate());
    }

    @Test
    void logMovementEntityId_gettersAndSetters() {
        LogMovementEntityId id = new LogMovementEntityId();
        id.setId(1L);
        id.setIdMatch(2L);
        assertEquals(1L, id.getId());
        assertEquals(2L, id.getIdMatch());
    }

    @Test
    void logMovementEntityId_equalsAndHashCode() {
        LogMovementEntityId a = new LogMovementEntityId(1L, 2L);
        LogMovementEntityId same = new LogMovementEntityId(1L, 2L);
        LogMovementEntityId otherId = new LogMovementEntityId(9L, 2L);
        LogMovementEntityId otherMatch = new LogMovementEntityId(1L, 9L);

        assertEquals(a, a);
        assertEquals(a, same);
        assertEquals(a.hashCode(), same.hashCode());
        assertNotEquals(a, otherId);
        assertNotEquals(a, otherMatch);
        assertNotEquals(a, new LogWeatherEntityId(1L, 2L));
        assertNotEquals(a, null);
    }

    // ── LogWeatherEntity ─────────────────────────────────────────────────────

    @Test
    void logWeatherEntity_gettersAndSetters() {
        LogWeatherEntity e = new LogWeatherEntity();
        e.setId(5L);
        e.setIdMatch(3L);
        e.setUuid("w-uuid");
        e.setClock(4);
        e.setIdWeather(8L);
        e.setTimestampStart("2026-01-01T00:00:00Z");
        e.setTimestampEnd("2026-01-01T06:00:00Z");
        e.setTsInsert("2026-01-01T00:00:00Z");
        e.setTsUpdate("2026-01-02T00:00:00Z");

        assertEquals(5L, e.getId());
        assertEquals(3L, e.getIdMatch());
        assertEquals("w-uuid", e.getUuid());
        assertEquals(4, e.getClock());
        assertEquals(8L, e.getIdWeather());
        assertEquals("2026-01-01T00:00:00Z", e.getTimestampStart());
        assertEquals("2026-01-01T06:00:00Z", e.getTimestampEnd());
        assertEquals("2026-01-01T00:00:00Z", e.getTsInsert());
        assertEquals("2026-01-02T00:00:00Z", e.getTsUpdate());
    }

    @Test
    void logWeatherEntity_prePersistAppliesDefaults() throws Exception {
        LogWeatherEntity e = new LogWeatherEntity();
        prePersist(e);

        assertNotNull(e.getUuid());
        assertEquals(0, e.getClock());
        assertNotNull(e.getTimestampStart());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
        assertNull(e.getTimestampEnd());
    }

    @Test
    void logWeatherEntity_prePersistDoesNotOverwriteExisting() throws Exception {
        LogWeatherEntity e = new LogWeatherEntity();
        e.setUuid("kept");
        e.setClock(6);
        e.setTimestampStart("ts-start");
        e.setTsInsert("ts-in");
        e.setTsUpdate("ts-up");
        prePersist(e);

        assertEquals("kept", e.getUuid());
        assertEquals(6, e.getClock());
        assertEquals("ts-start", e.getTimestampStart());
        assertEquals("ts-in", e.getTsInsert());
        assertEquals("ts-up", e.getTsUpdate());
    }

    @Test
    void logWeatherEntityId_gettersAndSetters() {
        LogWeatherEntityId id = new LogWeatherEntityId();
        id.setId(1L);
        id.setIdMatch(2L);
        assertEquals(1L, id.getId());
        assertEquals(2L, id.getIdMatch());
    }

    @Test
    void logWeatherEntityId_equalsAndHashCode() {
        LogWeatherEntityId a = new LogWeatherEntityId(1L, 2L);
        LogWeatherEntityId same = new LogWeatherEntityId(1L, 2L);
        LogWeatherEntityId otherId = new LogWeatherEntityId(9L, 2L);
        LogWeatherEntityId otherMatch = new LogWeatherEntityId(1L, 9L);

        assertEquals(a, a);
        assertEquals(a, same);
        assertEquals(a.hashCode(), same.hashCode());
        assertNotEquals(a, otherId);
        assertNotEquals(a, otherMatch);
        assertNotEquals(a, new LogMovementEntityId(1L, 2L));
        assertNotEquals(a, null);
    }
}
