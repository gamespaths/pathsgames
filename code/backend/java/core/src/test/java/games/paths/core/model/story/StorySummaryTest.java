package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the {@link StorySummary} record.
 */
class StorySummaryTest {

    private StorySummary sample(String uuid) {
        return new StorySummary(uuid, "Title", "Description", "Author",
                "adventure", "fantasy", "PUBLIC", 5, 2, 3, null);
    }

    @Test
    @DisplayName("Canonical constructor maps all components")
    void constructor_mapsAllFields() {
        StorySummary s = sample("uuid-1");
        assertAll(
            () -> assertEquals("uuid-1", s.uuid()),
            () -> assertEquals("Title", s.title()),
            () -> assertEquals("Description", s.description()),
            () -> assertEquals("Author", s.author()),
            () -> assertEquals("adventure", s.category()),
            () -> assertEquals("fantasy", s.group()),
            () -> assertEquals("PUBLIC", s.visibility()),
            () -> assertEquals(5, s.priority()),
            () -> assertEquals(2, s.peghi()),
            () -> assertEquals(3, s.difficultyCount())
        );
    }

    @Test
    @DisplayName("Allows null optional fields")
    void constructor_nullOptional() {
        StorySummary s = new StorySummary("uuid-2", null, null, null,
                null, null, null, 0, 0, 0, null);
        assertNull(s.title());
        assertNull(s.visibility());
        assertEquals(0, s.priority());
    }

    @Test
    @DisplayName("Throws IllegalStateException when uuid is null/blank/empty")
    void constructor_rejectsInvalidUuid() {
        assertThrows(IllegalStateException.class, () -> sample(null));
        assertThrows(IllegalStateException.class, () -> sample("  "));
        assertThrows(IllegalStateException.class, () -> sample(""));
    }

    @Test
    @DisplayName("equals/hashCode follow record value semantics")
    void valueSemantics() {
        assertEquals(sample("u"), sample("u"));
        assertEquals(sample("u").hashCode(), sample("u").hashCode());
    }
}
