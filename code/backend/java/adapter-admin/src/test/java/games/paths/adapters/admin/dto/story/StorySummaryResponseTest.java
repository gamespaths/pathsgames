package games.paths.adapters.admin.dto.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for admin {@link StorySummaryResponse}.
 * Covers all-args constructor, no-arg constructor, and getters/setters.
 */
class StorySummaryResponseTest {

    @Test
    @DisplayName("All-args constructor sets all fields correctly")
    void allArgsConstructor() {
        StorySummaryResponse r = new StorySummaryResponse(
                "uuid-1", "The Fantasy", "A dark fantasy", "Paths Games",
                "RPG", "Fantasy", "PUBLIC", 5, 100, 3);

        assertAll("StorySummaryResponse fields",
            () -> assertEquals("uuid-1",      r.getUuid()),
            () -> assertEquals("The Fantasy", r.getTitle()),
            () -> assertEquals("A dark fantasy", r.getDescription()),
            () -> assertEquals("Paths Games",  r.getAuthor()),
            () -> assertEquals("RPG",         r.getCategory()),
            () -> assertEquals("Fantasy",     r.getGroup()),
            () -> assertEquals("PUBLIC",      r.getVisibility()),
            () -> assertEquals(5,             r.getPriority()),
            () -> assertEquals(100,           r.getPeghi()),
            () -> assertEquals(3,             r.getDifficultyCount())
        );
    }

    @Test
    @DisplayName("No-arg constructor produces null/zero defaults")
    void noArgConstructor_defaults() {
        StorySummaryResponse r = new StorySummaryResponse();

        assertAll(
            () -> assertNull(r.getUuid()),
            () -> assertNull(r.getTitle()),
            () -> assertEquals(0, r.getDifficultyCount())
        );
    }

    @Test
    @DisplayName("Setters replace field values")
    void setters_replaceValues() {
        StorySummaryResponse r = new StorySummaryResponse();
        r.setUuid("u");
        r.setTitle("title");
        r.setDescription("desc");
        r.setAuthor("author");
        r.setCategory("cat");
        r.setGroup("grp");
        r.setVisibility("PRIVATE");
        r.setPriority(1);
        r.setPeghi(50);
        r.setDifficultyCount(2);

        assertAll(
            () -> assertEquals("u",       r.getUuid()),
            () -> assertEquals("title",   r.getTitle()),
            () -> assertEquals("desc",    r.getDescription()),
            () -> assertEquals("author",  r.getAuthor()),
            () -> assertEquals("cat",     r.getCategory()),
            () -> assertEquals("grp",     r.getGroup()),
            () -> assertEquals("PRIVATE", r.getVisibility()),
            () -> assertEquals(1,         r.getPriority()),
            () -> assertEquals(50,        r.getPeghi()),
            () -> assertEquals(2,         r.getDifficultyCount())
        );
    }

    @Test
    @DisplayName("Nullable Integer priority and peghi can be set to null")
    void nullableIntegerFields_acceptNull() {
        StorySummaryResponse r = new StorySummaryResponse();
        r.setPriority(null);
        r.setPeghi(null);

        assertNull(r.getPriority());
        assertNull(r.getPeghi());
    }
}
