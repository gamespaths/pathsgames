package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link DifficultyResponse}.
 * Covers all-args constructor, no-arg constructor, and getters/setters.
 */
class DifficultyResponseTest {

    @Test
    @DisplayName("All-args constructor should set all fields")
    void allArgsConstructor() {
        DifficultyResponse r = new DifficultyResponse(
                "diff-1", "Easy", 5, 10, 1, 4, 3, 3, 1);

        assertAll("DifficultyResponse fields",
            () -> assertEquals("diff-1", r.getUuid()),
            () -> assertEquals("Easy", r.getDescription()),
            () -> assertEquals(5, r.getExpCost()),
            () -> assertEquals(10, r.getMaxWeight()),
            () -> assertEquals(1, r.getMinCharacter()),
            () -> assertEquals(4, r.getMaxCharacter()),
            () -> assertEquals(3, r.getCostHelpComa()),
            () -> assertEquals(3, r.getCostMaxCharacteristics()),
            () -> assertEquals(1, r.getNumberMaxFreeAction())
        );
    }

    @Test
    @DisplayName("No-arg constructor and setters should work")
    void noArgConstructorAndSetters() {
        DifficultyResponse r = new DifficultyResponse();
        r.setUuid("diff-2");
        r.setDescription("Hard");
        r.setExpCost(10);
        r.setMaxWeight(20);
        r.setMinCharacter(2);
        r.setMaxCharacter(6);
        r.setCostHelpComa(5);
        r.setCostMaxCharacteristics(5);
        r.setNumberMaxFreeAction(2);

        assertAll("Setter values",
            () -> assertEquals("diff-2", r.getUuid()),
            () -> assertEquals("Hard", r.getDescription()),
            () -> assertEquals(10, r.getExpCost()),
            () -> assertEquals(20, r.getMaxWeight()),
            () -> assertEquals(2, r.getMinCharacter()),
            () -> assertEquals(6, r.getMaxCharacter()),
            () -> assertEquals(5, r.getCostHelpComa()),
            () -> assertEquals(5, r.getCostMaxCharacteristics()),
            () -> assertEquals(2, r.getNumberMaxFreeAction())
        );
    }
}
