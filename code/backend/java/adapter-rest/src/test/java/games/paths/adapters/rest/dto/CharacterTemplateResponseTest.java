package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link CharacterTemplateResponse}.
 * Covers all-args constructor, no-arg constructor, and getters/setters.
 */
class CharacterTemplateResponseTest {

    @Test
    @DisplayName("All-args constructor should set all fields")
    void allArgsConstructor() {
        CharacterTemplateResponse r = new CharacterTemplateResponse(
                "ct-1", "Warrior", "A strong fighter", 20, 15, 10, 3, 2, 4);

        assertAll("CharacterTemplateResponse fields",
            () -> assertEquals("ct-1", r.getUuid()),
            () -> assertEquals("Warrior", r.getName()),
            () -> assertEquals("A strong fighter", r.getDescription()),
            () -> assertEquals(20, r.getLifeMax()),
            () -> assertEquals(15, r.getEnergyMax()),
            () -> assertEquals(10, r.getSadMax()),
            () -> assertEquals(3, r.getDexterityStart()),
            () -> assertEquals(2, r.getIntelligenceStart()),
            () -> assertEquals(4, r.getConstitutionStart())
        );
    }

    @Test
    @DisplayName("No-arg constructor and setters should work")
    void noArgConstructorAndSetters() {
        CharacterTemplateResponse r = new CharacterTemplateResponse();
        r.setUuid("ct-2");
        r.setName("Mage");
        r.setDescription("A wise spellcaster");
        r.setLifeMax(12);
        r.setEnergyMax(25);
        r.setSadMax(8);
        r.setDexterityStart(1);
        r.setIntelligenceStart(5);
        r.setConstitutionStart(2);

        assertAll("Setter values",
            () -> assertEquals("ct-2", r.getUuid()),
            () -> assertEquals("Mage", r.getName()),
            () -> assertEquals("A wise spellcaster", r.getDescription()),
            () -> assertEquals(12, r.getLifeMax()),
            () -> assertEquals(25, r.getEnergyMax()),
            () -> assertEquals(8, r.getSadMax()),
            () -> assertEquals(1, r.getDexterityStart()),
            () -> assertEquals(5, r.getIntelligenceStart()),
            () -> assertEquals(2, r.getConstitutionStart())
        );
    }
}
