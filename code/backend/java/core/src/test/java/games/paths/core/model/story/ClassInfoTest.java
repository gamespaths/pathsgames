package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the {@link ClassInfo} record.
 */
class ClassInfoTest {

    private ClassInfo sample(List<ClassBonusInfo> bonuses) {
        return new ClassInfo(1L, "class-1", "Knight", "Noble warrior class",
                15, 2, 1, 3, null, null, bonuses);
    }

    @Test
    @DisplayName("Canonical constructor maps all components")
    void constructor_mapsAllFields() {
        ClassInfo ci = sample(List.of(new ClassBonusInfo("b-1", "life", 5)));
        assertAll(
            () -> assertEquals(1L, ci.id()),
            () -> assertEquals("class-1", ci.uuid()),
            () -> assertEquals("Knight", ci.name()),
            () -> assertEquals("Noble warrior class", ci.description()),
            () -> assertEquals(15, ci.weightMax()),
            () -> assertEquals(2, ci.dexterityBase()),
            () -> assertEquals(1, ci.intelligenceBase()),
            () -> assertEquals(3, ci.constitutionBase()),
            () -> assertEquals(1, ci.bonuses().size())
        );
    }

    @Test
    @DisplayName("Null bonuses normalised to an empty immutable list")
    void constructor_nullBonuses() {
        ClassInfo ci = sample(null);
        assertNotNull(ci.bonuses());
        assertTrue(ci.bonuses().isEmpty());
        assertThrows(UnsupportedOperationException.class,
                () -> ci.bonuses().add(new ClassBonusInfo("x", "y", 1)));
    }

    @Test
    @DisplayName("equals/hashCode follow record value semantics")
    void valueSemantics() {
        assertEquals(sample(List.of()), sample(List.of()));
        assertEquals(sample(List.of()).hashCode(), sample(List.of()).hashCode());
    }
}
