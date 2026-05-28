package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the {@link CharacterTemplateInfo} record.
 */
class CharacterTemplateInfoTest {

    private CharacterTemplateInfo sample() {
        return new CharacterTemplateInfo("ct-1", "Warrior", "Strong melee fighter",
                20, 10, 5, 2, 1, 3, null, null, null, null);
    }

    @Test
    @DisplayName("Canonical constructor maps all components")
    void constructor_mapsAllFields() {
        CharacterTemplateInfo ct = sample();
        assertAll(
            () -> assertEquals("ct-1", ct.uuid()),
            () -> assertEquals("Warrior", ct.name()),
            () -> assertEquals("Strong melee fighter", ct.description()),
            () -> assertEquals(20, ct.lifeMax()),
            () -> assertEquals(10, ct.energyMax()),
            () -> assertEquals(5, ct.sadMax()),
            () -> assertEquals(2, ct.dexterityStart()),
            () -> assertEquals(1, ct.intelligenceStart()),
            () -> assertEquals(3, ct.constitutionStart())
        );
    }

    @Test
    @DisplayName("Allows null optional fields")
    void constructor_nullOptional() {
        CharacterTemplateInfo ct = new CharacterTemplateInfo(null, null, null,
                0, 0, 0, 0, 0, 0, null, null, null, null);
        assertNull(ct.uuid());
        assertNull(ct.name());
        assertEquals(0, ct.lifeMax());
    }

    @Test
    @DisplayName("equals/hashCode follow record value semantics")
    void valueSemantics() {
        assertEquals(sample(), sample());
        assertEquals(sample().hashCode(), sample().hashCode());
    }
}
