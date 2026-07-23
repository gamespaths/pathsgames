package games.paths.core.entity.match;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the Step 32 resolution entities and their composite ids:
 * {@link LogChoicesExecutedEntity}, {@link GamingStoryProgressEntity} and the two
 * {@code *EntityId} classes.
 *
 * <p>Both tables have existed since V0.10.7 / V0.10.9; Step 32 is the first code to write
 * to either.</p>
 */
@DisplayName("Choice-resolution entities (Step 32)")
class ChoiceResolutionEntitiesTest {

    /** {@code @PrePersist} is protected — invoke it the way the JPA provider does. */
    private static void prePersist(Object entity) throws Exception {
        Method m = entity.getClass().getDeclaredMethod("onCreate");
        m.setAccessible(true);
        m.invoke(entity);
    }

    private static void preUpdate(Object entity) throws Exception {
        Method m = entity.getClass().getDeclaredMethod("onUpdate");
        m.setAccessible(true);
        m.invoke(entity);
    }

    // ── LogChoicesExecutedEntity ────────────────────────────────────────────

    @Test
    void logChoicesExecutedEntity_gettersAndSetters() {
        LogChoicesExecutedEntity e = new LogChoicesExecutedEntity();
        e.setId(5L);
        e.setIdMatch(3L);
        e.setUuid("log-uuid");
        e.setClock(7);
        e.setIdEvent(12L);
        e.setIdChoise(20L);
        e.setLogMessage("CHOICE_SELECTED 20");
        e.setTsInsert("2026-01-01T00:00:00Z");
        e.setTsUpdate("2026-01-02T00:00:00Z");

        assertEquals(5L, e.getId());
        assertEquals(3L, e.getIdMatch());
        assertEquals("log-uuid", e.getUuid());
        assertEquals(7, e.getClock());
        assertEquals(12L, e.getIdEvent());
        assertEquals(20L, e.getIdChoise());
        assertEquals("CHOICE_SELECTED 20", e.getLogMessage());
        assertEquals("2026-01-01T00:00:00Z", e.getTsInsert());
        assertEquals("2026-01-02T00:00:00Z", e.getTsUpdate());
    }

    @Test
    void logChoicesExecutedEntity_prePersistAppliesDefaults() throws Exception {
        LogChoicesExecutedEntity e = new LogChoicesExecutedEntity();
        prePersist(e);

        assertNotNull(e.getUuid());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void logChoicesExecutedEntity_prePersistDoesNotOverwriteExisting() throws Exception {
        LogChoicesExecutedEntity e = new LogChoicesExecutedEntity();
        e.setUuid("kept");
        e.setTsInsert("ts-in");
        e.setTsUpdate("ts-up");
        prePersist(e);

        assertEquals("kept", e.getUuid());
        assertEquals("ts-in", e.getTsInsert());
        assertEquals("ts-up", e.getTsUpdate());
    }

    @Test
    void logChoicesExecutedEntity_preUpdateStampsTheUpdate() throws Exception {
        LogChoicesExecutedEntity e = new LogChoicesExecutedEntity();
        e.setTsUpdate("stale");
        preUpdate(e);

        assertNotEquals("stale", e.getTsUpdate());
    }

    // ── GamingStoryProgressEntity ───────────────────────────────────────────

    @Test
    void gamingStoryProgressEntity_gettersAndSetters() {
        GamingStoryProgressEntity e = new GamingStoryProgressEntity();
        e.setId(4L);
        e.setIdMatch(3L);
        e.setUuid("progress-uuid");
        e.setClock(7);
        e.setIdEvent(12L);
        e.setIdChoise(20L);
        e.setTsInsert("2026-01-01T00:00:00Z");
        e.setTsUpdate("2026-01-02T00:00:00Z");

        assertEquals(4L, e.getId());
        assertEquals(3L, e.getIdMatch());
        assertEquals("progress-uuid", e.getUuid());
        assertEquals(7, e.getClock());
        assertEquals(12L, e.getIdEvent());
        assertEquals(20L, e.getIdChoise());
        assertEquals("2026-01-01T00:00:00Z", e.getTsInsert());
        assertEquals("2026-01-02T00:00:00Z", e.getTsUpdate());
    }

    @Test
    void gamingStoryProgressEntity_prePersistAppliesDefaults() throws Exception {
        GamingStoryProgressEntity e = new GamingStoryProgressEntity();
        prePersist(e);

        assertNotNull(e.getUuid());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void gamingStoryProgressEntity_prePersistDoesNotOverwriteExisting() throws Exception {
        GamingStoryProgressEntity e = new GamingStoryProgressEntity();
        e.setUuid("kept");
        e.setTsInsert("ts-in");
        e.setTsUpdate("ts-up");
        prePersist(e);

        assertEquals("kept", e.getUuid());
        assertEquals("ts-in", e.getTsInsert());
        assertEquals("ts-up", e.getTsUpdate());
    }

    @Test
    void gamingStoryProgressEntity_preUpdateStampsTheUpdate() throws Exception {
        GamingStoryProgressEntity e = new GamingStoryProgressEntity();
        e.setTsUpdate("stale");
        preUpdate(e);

        assertNotEquals("stale", e.getTsUpdate());
    }

    // ── the composite ids ───────────────────────────────────────────────────

    @Test
    @DisplayName("equality is by (id, id_match) and never across entity types")
    void compositeIds() {
        LogChoicesExecutedEntityId log = new LogChoicesExecutedEntityId(1L, 2L);
        GamingStoryProgressEntityId progress = new GamingStoryProgressEntityId(1L, 2L);

        assertEquals(log, new LogChoicesExecutedEntityId(1L, 2L));
        assertEquals(log.hashCode(), new LogChoicesExecutedEntityId(1L, 2L).hashCode());
        assertNotEquals(log, new LogChoicesExecutedEntityId(1L, 3L));
        // Same numbers, different tables: AbstractMatchScopedEntityId compares getClass().
        assertNotEquals(log, progress);
        assertEquals(progress, new GamingStoryProgressEntityId(1L, 2L));
    }

    @Test
    void compositeIds_noArgConstructorAndSetters() {
        LogChoicesExecutedEntityId log = new LogChoicesExecutedEntityId();
        log.setId(9L);
        log.setIdMatch(8L);

        assertEquals(9L, log.getId());
        assertEquals(8L, log.getIdMatch());
        assertEquals(new LogChoicesExecutedEntityId(9L, 8L), log);

        // The no-arg constructor is what JPA itself calls when it materialises a key.
        GamingStoryProgressEntityId progress = new GamingStoryProgressEntityId();
        progress.setId(9L);
        progress.setIdMatch(8L);

        assertEquals(9L, progress.getId());
        assertEquals(8L, progress.getIdMatch());
        assertEquals(new GamingStoryProgressEntityId(9L, 8L), progress);
    }
}
