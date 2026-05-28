package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link ClassInfoResponse}.
 * Covers all-args constructor, no-arg constructor, and getters/setters.
 */
class ClassInfoResponseTest {

    @Test
    @DisplayName("All-args constructor should set all fields")
    void allArgsConstructor() {
        ClassInfoResponse r = new ClassInfoResponse(
                "class-1", "Knight", "Noble warrior", 20, 3, 2, 4);

        assertAll("ClassInfoResponse fields",
            () -> assertEquals("class-1", r.getUuid()),
            () -> assertEquals("Knight", r.getName()),
            () -> assertEquals("Noble warrior", r.getDescription()),
            () -> assertEquals(20, r.getWeightMax()),
            () -> assertEquals(3, r.getDexterityBase()),
            () -> assertEquals(2, r.getIntelligenceBase()),
            () -> assertEquals(4, r.getConstitutionBase())
        );
    }

    @Test
    @DisplayName("No-arg constructor and setters should work")
    void noArgConstructorAndSetters() {
        ClassInfoResponse r = new ClassInfoResponse();
        r.setUuid("class-2");
        r.setName("Wizard");
        r.setDescription("Master of arcane arts");
        r.setWeightMax(10);
        r.setDexterityBase(1);
        r.setIntelligenceBase(5);
        r.setConstitutionBase(2);

        assertAll("Setter values",
            () -> assertEquals("class-2", r.getUuid()),
            () -> assertEquals("Wizard", r.getName()),
            () -> assertEquals("Master of arcane arts", r.getDescription()),
            () -> assertEquals(10, r.getWeightMax()),
            () -> assertEquals(1, r.getDexterityBase()),
            () -> assertEquals(5, r.getIntelligenceBase()),
            () -> assertEquals(2, r.getConstitutionBase())
        );
    }
}
