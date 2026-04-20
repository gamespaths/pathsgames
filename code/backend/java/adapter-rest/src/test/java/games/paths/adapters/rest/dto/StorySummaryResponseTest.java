package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link StorySummaryResponse}.
 * Covers constructor, getters/setters, and no-arg constructor.
 */
class StorySummaryResponseTest {

    @Test
    @DisplayName("All-args constructor should set all fields")
    void allArgsConstructor() {
        StorySummaryResponse r = new StorySummaryResponse(
                "uuid-1", "Title", "Desc", "Author",
                "adventure", "fantasy", "PUBLIC", 5, 2, 3, null);

        assertAll("StorySummaryResponse fields",
            () -> assertEquals("uuid-1", r.getUuid()),
            () -> assertEquals("Title", r.getTitle()),
            () -> assertEquals("Desc", r.getDescription()),
            () -> assertEquals("Author", r.getAuthor()),
            () -> assertEquals("adventure", r.getCategory()),
            () -> assertEquals("fantasy", r.getGroup()),
            () -> assertEquals("PUBLIC", r.getVisibility()),
            () -> assertEquals(5, r.getPriority()),
            () -> assertEquals(2, r.getPeghi()),
            () -> assertEquals(3, r.getDifficultyCount()),
            () -> assertNull(r.getCard())
        );
    }

    @Test
    @DisplayName("All-args constructor with card should set card field")
    void allArgsConstructor_withCard() {
        CardInfoResponse card = new CardInfoResponse();
        card.setUuid("card-uuid");
        card.setTitle("Card Title");

        StorySummaryResponse r = new StorySummaryResponse(
                "uuid-1", "Title", "Desc", "Author",
                "adventure", "fantasy", "PUBLIC", 5, 2, 3, card);

        assertAll("StorySummaryResponse with card",
            () -> assertEquals("uuid-1", r.getUuid()),
            () -> assertNotNull(r.getCard()),
            () -> assertEquals("card-uuid", r.getCard().getUuid()),
            () -> assertEquals("Card Title", r.getCard().getTitle())
        );
    }

    @Test
    @DisplayName("No-arg constructor and setters should work")
    void noArgConstructorAndSetters() {
        StorySummaryResponse r = new StorySummaryResponse();
        r.setUuid("uuid-2");
        r.setTitle("Title2");
        r.setDescription("Desc2");
        r.setAuthor("Author2");
        r.setCategory("horror");
        r.setGroup("dark");
        r.setVisibility("PRIVATE");
        r.setPriority(3);
        r.setPeghi(1);
        r.setDifficultyCount(2);

        CardInfoResponse card = new CardInfoResponse();
        card.setUuid("card-uuid");
        r.setCard(card);

        assertAll("Setter values",
            () -> assertEquals("uuid-2", r.getUuid()),
            () -> assertEquals("Title2", r.getTitle()),
            () -> assertEquals("Desc2", r.getDescription()),
            () -> assertEquals("Author2", r.getAuthor()),
            () -> assertEquals("horror", r.getCategory()),
            () -> assertEquals("dark", r.getGroup()),
            () -> assertEquals("PRIVATE", r.getVisibility()),
            () -> assertEquals(3, r.getPriority()),
            () -> assertEquals(1, r.getPeghi()),
            () -> assertEquals(2, r.getDifficultyCount()),
            () -> assertNotNull(r.getCard()),
            () -> assertEquals("card-uuid", r.getCard().getUuid())
        );
    }
}
