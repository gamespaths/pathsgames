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
        CreatorInfoResponse creator = new CreatorInfoResponse(
                "cr-1", "Author", null, null, null, null, null);
        CardInfoResponse r = new CardInfoResponse(
                "card-1", "https://img.com/card.png", "alt.jpg",
                "fa-star", "bg-dark", "text-light",
                "Card Title", "Card Description",
                "© 2026", "https://copy.com", creator);

        assertAll("CardInfoResponse fields",
            () -> assertEquals("card-1", r.getUuid()),
            () -> assertEquals("https://img.com/card.png", r.getImageUrl()),
            () -> assertEquals("alt.jpg", r.getAlternativeImage()),
            () -> assertEquals("fa-star", r.getAwesomeIcon()),
            () -> assertEquals("bg-dark", r.getStyleMain()),
            () -> assertEquals("text-light", r.getStyleDetail()),
            () -> assertEquals("Card Title", r.getTitle()),
            () -> assertEquals("Card Description", r.getDescription()),
            () -> assertEquals("© 2026", r.getCopyrightText()),
            () -> assertEquals("https://copy.com", r.getLinkCopyright()),
            () -> assertNotNull(r.getCreator()),
            () -> assertEquals("cr-1", r.getCreator().getUuid())
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
        r.setDescription("Description Two");
        r.setCopyrightText("© 2026");
        r.setLinkCopyright("https://copy2.com");
        r.setCreator(null);

        assertAll("Setter values",
            () -> assertEquals("card-2", r.getUuid()),
            () -> assertEquals("https://img.com/card2.png", r.getImageUrl()),
            () -> assertEquals("alt2.jpg", r.getAlternativeImage()),
            () -> assertEquals("fa-heart", r.getAwesomeIcon()),
            () -> assertEquals("bg-primary", r.getStyleMain()),
            () -> assertEquals("text-dark", r.getStyleDetail()),
            () -> assertEquals("Card Two", r.getTitle()),
            () -> assertEquals("Description Two", r.getDescription()),
            () -> assertEquals("© 2026", r.getCopyrightText()),
            () -> assertEquals("https://copy2.com", r.getLinkCopyright()),
            () -> assertNull(r.getCreator())
        );
    }
}
