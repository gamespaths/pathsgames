package games.paths.adapters.admin.dto.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link StoryImportResponse}.
 * Covers all-args constructor, no-arg constructor, and getters/setters.
 */
class StoryImportResponseTest {

    @Test
    @DisplayName("All-args constructor should set all fields")
    void allArgsConstructor() {
        StoryImportResponse r = new StoryImportResponse(
                "uuid-1", "IMPORTED", 10, 5, 3, 7, 2, 4, 6);

        assertAll("StoryImportResponse fields",
            () -> assertEquals("uuid-1", r.getStoryUuid()),
            () -> assertEquals("IMPORTED", r.getStatus()),
            () -> assertEquals(10, r.getTextsImported()),
            () -> assertEquals(5, r.getLocationsImported()),
            () -> assertEquals(3, r.getEventsImported()),
            () -> assertEquals(7, r.getItemsImported()),
            () -> assertEquals(2, r.getDifficultiesImported()),
            () -> assertEquals(4, r.getClassesImported()),
            () -> assertEquals(6, r.getChoicesImported())
        );
    }

    @Test
    @DisplayName("No-arg constructor and setters should work")
    void noArgConstructorAndSetters() {
        StoryImportResponse r = new StoryImportResponse();
        r.setStoryUuid("uuid-2");
        r.setStatus("REPLACED");
        r.setTextsImported(20);
        r.setLocationsImported(10);
        r.setEventsImported(6);
        r.setItemsImported(14);
        r.setDifficultiesImported(4);
        r.setClassesImported(8);
        r.setChoicesImported(12);

        assertAll("Setter values",
            () -> assertEquals("uuid-2", r.getStoryUuid()),
            () -> assertEquals("REPLACED", r.getStatus()),
            () -> assertEquals(20, r.getTextsImported()),
            () -> assertEquals(10, r.getLocationsImported()),
            () -> assertEquals(6, r.getEventsImported()),
            () -> assertEquals(14, r.getItemsImported()),
            () -> assertEquals(4, r.getDifficultiesImported()),
            () -> assertEquals(8, r.getClassesImported()),
            () -> assertEquals(12, r.getChoicesImported())
        );
    }

    @Test
    @DisplayName("Default values should be 0 for int fields and null for strings")
    void defaultValues() {
        StoryImportResponse r = new StoryImportResponse();

        assertAll("Default values",
            () -> assertNull(r.getStoryUuid()),
            () -> assertNull(r.getStatus()),
            () -> assertEquals(0, r.getTextsImported()),
            () -> assertEquals(0, r.getLocationsImported())
        );
    }
}
