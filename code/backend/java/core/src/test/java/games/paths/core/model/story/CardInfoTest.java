package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the {@link CardInfo} record.
 */
class CardInfoTest {

    private CardInfo sample() {
        return new CardInfo("card-1", "STORY", "https://example.com/card.png", "alt-text",
                "fa-star", "bg-primary", "text-light", "little", "medium", "large",
                "Card Title", "Card Description", "© 2026", "https://example.com",
                new CreatorInfo("cr-1", "Author", null, null, null, null, null));
    }

    @Test
    @DisplayName("Canonical constructor maps all components")
    void constructor_mapsAllFields() {
        CardInfo ci = sample();
        assertAll(
            () -> assertEquals("card-1", ci.uuid()),
            () -> assertEquals("STORY", ci.cardType()),
            () -> assertEquals("https://example.com/card.png", ci.urlImage()),
            () -> assertEquals("alt-text", ci.alternativeImage()),
            () -> assertEquals("fa-star", ci.awesomeIcon()),
            () -> assertEquals("bg-primary", ci.styleMain()),
            () -> assertEquals("text-light", ci.styleDetail()),
            () -> assertEquals("little", ci.styleImageLittle()),
            () -> assertEquals("medium", ci.styleImageMedium()),
            () -> assertEquals("large", ci.styleImageLarge()),
            () -> assertEquals("Card Title", ci.title()),
            () -> assertEquals("Card Description", ci.description()),
            () -> assertEquals("© 2026", ci.copyrightText()),
            () -> assertEquals("https://example.com", ci.linkCopyright()),
            () -> assertNotNull(ci.creator()),
            () -> assertEquals("cr-1", ci.creator().uuid())
        );
    }

    @Test
    @DisplayName("Allows all null fields")
    void constructor_allNull() {
        CardInfo ci = new CardInfo(null, null, null, null, null, null, null,
                null, null, null, null, null, null, null, null);
        assertNull(ci.uuid());
        assertNull(ci.creator());
    }

    @Test
    @DisplayName("equals/hashCode follow record value semantics")
    void valueSemantics() {
        assertEquals(sample(), sample());
        assertEquals(sample().hashCode(), sample().hashCode());
    }
}
