package games.paths.core.entity.story;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class CharacterTemplateScopedEntityIdTest {

    @Test
    void noArgConstructorAndSetters() {
        CharacterTemplateScopedEntityId sid = new CharacterTemplateScopedEntityId();
        assertNull(sid.getIdTipo());
        assertNull(sid.getIdStoryPk());

        sid.setIdTipo(7L);
        sid.setIdStoryPk(42L);
        assertEquals(7L, sid.getIdTipo());
        assertEquals(42L, sid.getIdStoryPk());
    }

    @Test
    void allArgsConstructorAndGetters() {
        CharacterTemplateScopedEntityId sid = new CharacterTemplateScopedEntityId(3L, 100L);
        assertEquals(3L, sid.getIdTipo());
        assertEquals(100L, sid.getIdStoryPk());
    }

    @Test
    void equalsAndHashCode_equal() {
        CharacterTemplateScopedEntityId a = new CharacterTemplateScopedEntityId(1L, 2L);
        CharacterTemplateScopedEntityId b = new CharacterTemplateScopedEntityId(1L, 2L);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void equalsAndHashCode_differentIdTipo() {
        CharacterTemplateScopedEntityId a = new CharacterTemplateScopedEntityId(1L, 2L);
        CharacterTemplateScopedEntityId b = new CharacterTemplateScopedEntityId(9L, 2L);
        assertNotEquals(a, b);
    }

    @Test
    void equalsAndHashCode_differentStoryPk() {
        CharacterTemplateScopedEntityId a = new CharacterTemplateScopedEntityId(1L, 2L);
        CharacterTemplateScopedEntityId b = new CharacterTemplateScopedEntityId(1L, 9L);
        assertNotEquals(a, b);
    }

    @Test
    void equalsAndHashCode_bothNull() {
        CharacterTemplateScopedEntityId a = new CharacterTemplateScopedEntityId();
        CharacterTemplateScopedEntityId b = new CharacterTemplateScopedEntityId();
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void equals_sameInstance() {
        CharacterTemplateScopedEntityId a = new CharacterTemplateScopedEntityId(1L, 2L);
        assertEquals(a, a);
    }

    @Test
    void equals_differentType() {
        CharacterTemplateScopedEntityId a = new CharacterTemplateScopedEntityId(1L, 2L);
        assertNotEquals(a, "not an id");
    }
}
