package games.paths.core.entity.story;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class StoryScopedEntityIdTest {

    @Test
    void noArgConstructorAndSetters() {
        StoryScopedEntityId sid = new StoryScopedEntityId();
        assertNull(sid.getId());
        assertNull(sid.getIdStoryPk());

        sid.setId(10L);
        sid.setIdStoryPk(20L);
        assertEquals(10L, sid.getId());
        assertEquals(20L, sid.getIdStoryPk());
    }

    @Test
    void allArgsConstructorAndGetters() {
        StoryScopedEntityId sid = new StoryScopedEntityId(5L, 99L);
        assertEquals(5L, sid.getId());
        assertEquals(99L, sid.getIdStoryPk());
    }

    @Test
    void equalsAndHashCode_equal() {
        StoryScopedEntityId a = new StoryScopedEntityId(1L, 2L);
        StoryScopedEntityId b = new StoryScopedEntityId(1L, 2L);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void equalsAndHashCode_differentId() {
        StoryScopedEntityId a = new StoryScopedEntityId(1L, 2L);
        StoryScopedEntityId b = new StoryScopedEntityId(9L, 2L);
        assertNotEquals(a, b);
    }

    @Test
    void equalsAndHashCode_differentStoryPk() {
        StoryScopedEntityId a = new StoryScopedEntityId(1L, 2L);
        StoryScopedEntityId b = new StoryScopedEntityId(1L, 9L);
        assertNotEquals(a, b);
    }

    @Test
    void equalsAndHashCode_bothNull() {
        StoryScopedEntityId a = new StoryScopedEntityId();
        StoryScopedEntityId b = new StoryScopedEntityId();
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void equals_sameInstance() {
        StoryScopedEntityId a = new StoryScopedEntityId(1L, 2L);
        assertEquals(a, a);
    }

    @Test
    void equals_differentType() {
        StoryScopedEntityId a = new StoryScopedEntityId(1L, 2L);
        assertNotEquals(a, "not an id");
    }
}
