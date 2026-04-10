package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link StoryImportResult}.
 * Validates builder logic, mandatory fields, and default values.
 */
@ExtendWith(MockitoExtension.class)
class StoryImportResultTest {

    private StoryImportResult.Builder validBuilder() {
        return StoryImportResult.builder()
                .storyUuid("uuid-1")
                .status("IMPORTED")
                .textsImported(10)
                .locationsImported(5)
                .eventsImported(3)
                .itemsImported(7)
                .difficultiesImported(2)
                .classesImported(4)
                .choicesImported(6);
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            StoryImportResult r = validBuilder().build();

            assertAll("StoryImportResult fields",
                () -> assertEquals("uuid-1", r.getStoryUuid()),
                () -> assertEquals("IMPORTED", r.getStatus()),
                () -> assertEquals(10, r.getTextsImported()),
                () -> assertEquals(5, r.getLocationsImported()),
                () -> assertEquals(3, r.getEventsImported()),
                () -> assertEquals(7, r.getItemsImported()),
                () -> assertEquals(2, r.getDifficultiesImported()),
                () -> assertEquals(4, r.getClassesImported()),
                () -> assertEquals(6, r.getChoicesImported()),
                () -> assertTrue(r.toString().contains("uuid-1")),
                () -> assertTrue(r.toString().contains("IMPORTED"))
            );
        }

        @Test
        @DisplayName("Should default counts to 0 when not set")
        void build_defaultCounts() {
            StoryImportResult r = StoryImportResult.builder()
                    .storyUuid("uuid-2")
                    .status("IMPORTED")
                    .build();

            assertAll("Default counts",
                () -> assertEquals(0, r.getTextsImported()),
                () -> assertEquals(0, r.getLocationsImported()),
                () -> assertEquals(0, r.getEventsImported()),
                () -> assertEquals(0, r.getItemsImported()),
                () -> assertEquals(0, r.getDifficultiesImported()),
                () -> assertEquals(0, r.getClassesImported()),
                () -> assertEquals(0, r.getChoicesImported())
            );
        }
    }

    @Nested
    @DisplayName("Builder Validation Tests")
    class ValidationTests {

        @Test
        @DisplayName("Should throw IllegalStateException when storyUuid is null")
        void validate_nullStoryUuid() {
            assertThrows(IllegalStateException.class, () ->
                    validBuilder().storyUuid(null).build());
        }

        @Test
        @DisplayName("Should throw IllegalStateException when storyUuid is blank")
        void validate_blankStoryUuid() {
            assertThrows(IllegalStateException.class, () ->
                    validBuilder().storyUuid("  ").build());
        }

        @Test
        @DisplayName("Should throw IllegalStateException when status is null")
        void validate_nullStatus() {
            assertThrows(IllegalStateException.class, () ->
                    validBuilder().status(null).build());
        }

        @Test
        @DisplayName("Should throw IllegalStateException when status is blank")
        void validate_blankStatus() {
            assertThrows(IllegalStateException.class, () ->
                    validBuilder().status("  ").build());
        }

        @Test
        @DisplayName("Should throw IllegalStateException when storyUuid is empty")
        void validate_emptyStoryUuid() {
            assertThrows(IllegalStateException.class, () ->
                    validBuilder().storyUuid("").build());
        }

        @Test
        @DisplayName("Should throw IllegalStateException when status is empty")
        void validate_emptyStatus() {
            assertThrows(IllegalStateException.class, () ->
                    validBuilder().status("").build());
        }
    }
}
