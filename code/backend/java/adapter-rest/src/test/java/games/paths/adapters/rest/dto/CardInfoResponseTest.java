package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link CardInfoResponse}.
 * Covers all-args constructor, no-arg constructor, and getters/setters.
 */
class CardInfoResponseTest {

    @Test
    @DisplayName("All-args constructor should set all fields")
    void allArgsConstructor() {
        CardInfoResponse r = new CardInfoResponse(
                "card-1", "https://img.com/card.png", "alt.jpg",
                "fa-star", "bg-dark", "text-light", "Card Title");

        assertAll("CardInfoResponse fields",
            () -> assertEquals("card-1", r.getUuid()),
            () -> assertEquals("https://img.com/card.png", r.getImageUrl()),
            () -> assertEquals("alt.jpg", r.getAlternativeImage()),
            () -> assertEquals("fa-star", r.getAwesomeIcon()),
            () -> assertEquals("bg-dark", r.getStyleMain()),
            () -> assertEquals("text-light", r.getStyleDetail()),
            () -> assertEquals("Card Title", r.getTitle())
        );
    }

    @Test
    @DisplayName("No-arg constructor and setters should work")
    void noArgConstructorAndSetters() {
        CardInfoResponse r = new CardInfoResponse();
        r.setUuid("card-2");
        r.setImageUrl("https://img.com/card2.png");
        r.setAlternativeImage("alt2.jpg");
        r.setAwesomeIcon("fa-heart");
        r.setStyleMain("bg-primary");
        r.setStyleDetail("text-dark");
        r.setTitle("Card Two");

        assertAll("Setter values",
            () -> assertEquals("card-2", r.getUuid()),
            () -> assertEquals("https://img.com/card2.png", r.getImageUrl()),
            () -> assertEquals("alt2.jpg", r.getAlternativeImage()),
            () -> assertEquals("fa-heart", r.getAwesomeIcon()),
            () -> assertEquals("bg-primary", r.getStyleMain()),
            () -> assertEquals("text-dark", r.getStyleDetail()),
            () -> assertEquals("Card Two", r.getTitle())
        );
    }
}
