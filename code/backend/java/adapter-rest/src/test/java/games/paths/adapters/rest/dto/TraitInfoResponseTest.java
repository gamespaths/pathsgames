package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link TraitInfoResponse}.
 * Covers all-args constructor, no-arg constructor, and getters/setters.
 */
class TraitInfoResponseTest {

    @Test
    @DisplayName("All-args constructor should set all fields")
    void allArgsConstructor() {
        TraitInfoResponse r = new TraitInfoResponse(
                "trait-1", "Brave", "Fearless", 5, 3, 10, 20);

        assertAll("TraitInfoResponse fields",
            () -> assertEquals("trait-1", r.getUuid()),
            () -> assertEquals("Brave", r.getName()),
            () -> assertEquals("Fearless", r.getDescription()),
            () -> assertEquals(5, r.getCostPositive()),
            () -> assertEquals(3, r.getCostNegative()),
            () -> assertEquals(10, r.getIdClassPermitted()),
            () -> assertEquals(20, r.getIdClassProhibited())
        );
    }

    @Test
    @DisplayName("No-arg constructor and setters should work")
    void noArgConstructorAndSetters() {
        TraitInfoResponse r = new TraitInfoResponse();
        r.setUuid("trait-2");
        r.setName("Cowardly");
        r.setDescription("Easily frightened");
        r.setCostPositive(2);
        r.setCostNegative(4);
        r.setIdClassPermitted(null);
        r.setIdClassProhibited(null);

        assertAll("Setter values",
            () -> assertEquals("trait-2", r.getUuid()),
            () -> assertEquals("Cowardly", r.getName()),
            () -> assertEquals("Easily frightened", r.getDescription()),
            () -> assertEquals(2, r.getCostPositive()),
            () -> assertEquals(4, r.getCostNegative()),
            () -> assertNull(r.getIdClassPermitted()),
            () -> assertNull(r.getIdClassProhibited())
        );
    }
}
