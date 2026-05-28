package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the {@link StoryImportResult} record.
 */
class StoryImportResultTest {

    private StoryImportResult sample(String storyUuid, String status) {
        return new StoryImportResult(storyUuid, status, 10, 5, 3, 7, 2, 4, 6);
    }

    @Test
    @DisplayName("Canonical constructor maps all components")
    void constructor_mapsAllFields() {
        StoryImportResult r = sample("uuid-1", "IMPORTED");
        assertAll(
            () -> assertEquals("uuid-1", r.storyUuid()),
            () -> assertEquals("IMPORTED", r.status()),
            () -> assertEquals(10, r.textsImported()),
            () -> assertEquals(5, r.locationsImported()),
            () -> assertEquals(3, r.eventsImported()),
            () -> assertEquals(7, r.itemsImported()),
            () -> assertEquals(2, r.difficultiesImported()),
            () -> assertEquals(4, r.classesImported()),
            () -> assertEquals(6, r.choicesImported())
        );
    }

    @Test
    @DisplayName("Throws IllegalStateException for invalid storyUuid/status")
    void constructor_rejectsInvalid() {
        assertThrows(IllegalStateException.class, () -> sample(null, "IMPORTED"));
        assertThrows(IllegalStateException.class, () -> sample("  ", "IMPORTED"));
        assertThrows(IllegalStateException.class, () -> sample("", "IMPORTED"));
        assertThrows(IllegalStateException.class, () -> sample("uuid-1", null));
        assertThrows(IllegalStateException.class, () -> sample("uuid-1", "  "));
        assertThrows(IllegalStateException.class, () -> sample("uuid-1", ""));
    }

    @Test
    @DisplayName("equals/hashCode follow record value semantics")
    void valueSemantics() {
        assertEquals(sample("u", "IMPORTED"), sample("u", "IMPORTED"));
        assertEquals(sample("u", "IMPORTED").hashCode(), sample("u", "IMPORTED").hashCode());
    }
}
