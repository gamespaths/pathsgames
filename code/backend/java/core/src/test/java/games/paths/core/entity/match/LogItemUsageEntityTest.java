package games.paths.core.entity.match;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/** Lifecycle and accessors of {@link LogItemUsageEntity} (Step 34). */
@DisplayName("LogItemUsageEntity (Step 34, widened in v0.35.4)")
class LogItemUsageEntityTest {

    private static void invoke(Object target, String name) throws Exception {
        Method m = target.getClass().getDeclaredMethod(name);
        m.setAccessible(true);
        m.invoke(target);
    }

    @Test
    @DisplayName("onCreate fills uuid, counter, timestamp and both ts columns")
    void onCreateDefaults() throws Exception {
        LogItemUsageEntity row = new LogItemUsageEntity();

        invoke(row, "onCreate");

        assertNotNull(row.getUuid());
        assertEquals(1, row.getCounter());
        assertNotNull(row.getTimestamp());
        assertNotNull(row.getTsInsert());
        assertNotNull(row.getTsUpdate());
        // v0.35.4 — USE is the default because that is all the table logged before it.
        assertEquals("USE", row.getAction());
        assertEquals(0, row.getEnergy());
        assertEquals(0, row.getFood());
        assertEquals(0, row.getMagic());
        assertEquals(0, row.getCoin());
    }

    @Test
    @DisplayName("onCreate never overwrites what the caller already set")
    void onCreateKeepsExplicitValues() throws Exception {
        LogItemUsageEntity row = new LogItemUsageEntity();
        row.setUuid("fixed-uuid");
        row.setCounter(3);
        row.setTimestamp("2026-01-01T00:00:00Z");
        row.setTsInsert("ins");
        row.setTsUpdate("upd");
        row.setAction("ADD");
        row.setEnergy(9);

        invoke(row, "onCreate");

        assertEquals("fixed-uuid", row.getUuid());
        assertEquals(3, row.getCounter());
        assertEquals("2026-01-01T00:00:00Z", row.getTimestamp());
        assertEquals("ins", row.getTsInsert());
        assertEquals("upd", row.getTsUpdate());
        assertEquals("ADD", row.getAction());
        assertEquals(9, row.getEnergy());
    }

    @Test
    void onUpdateRefreshesTsUpdateOnly() throws Exception {
        LogItemUsageEntity row = new LogItemUsageEntity();
        row.setTsInsert("ins");
        row.setTsUpdate("old");

        invoke(row, "onUpdate");

        assertEquals("ins", row.getTsInsert());
        assertNotEquals("old", row.getTsUpdate());
    }

    @Test
    void accessors() {
        LogItemUsageEntity row = new LogItemUsageEntity();
        row.setId(42L);
        row.setIdMatch(1L);
        row.setIdCharacterMatch(50L);
        row.setIdItem(900L);
        row.setEffectsJson("{\"a\":1}");
        row.setIdEvent(42L);
        row.setFood(-2);
        row.setMagic(3);
        row.setCoin(-4);

        assertEquals(42L, row.getIdEvent());
        assertEquals(-2, row.getFood());
        assertEquals(3, row.getMagic());
        assertEquals(-4, row.getCoin());
        assertEquals(42L, row.getId());
        assertEquals(1L, row.getIdMatch());
        assertEquals(50L, row.getIdCharacterMatch());
        assertEquals(900L, row.getIdItem());
        assertEquals("{\"a\":1}", row.getEffectsJson());
    }

    @Test
    @DisplayName("the composite key compares on both columns")
    void compositeKey() {
        LogItemUsageEntityId a = new LogItemUsageEntityId(1L, 2L);
        LogItemUsageEntityId same = new LogItemUsageEntityId(1L, 2L);
        LogItemUsageEntityId otherMatch = new LogItemUsageEntityId(1L, 3L);

        //assertEquals(a, a); --> assertThat(obj).isEqualTo(obj); // Compliant
        assertEquals(a, same);
        assertEquals(a.hashCode(), same.hashCode());
        assertNotEquals(a, otherMatch);
        assertNotEquals(a, new Object());
        assertNotEquals(a, null);

        LogItemUsageEntityId empty = new LogItemUsageEntityId();
        empty.setId(1L);
        empty.setIdMatch(2L);
        assertEquals(a, empty);
        assertEquals(1L, empty.getId());
        assertEquals(2L, empty.getIdMatch());
    }
}
