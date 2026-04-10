package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link StorySummary}.
 * Validates builder logic, mandatory fields, and default values.
 */
@ExtendWith(MockitoExtension.class)
class StorySummaryTest {

    private StorySummary.Builder validBuilder() {
        return StorySummary.builder()
                .uuid("uuid-1")
                .title("Title")
                .description("Description")
                .author("Author")
                .category("adventure")
                .group("fantasy")
                .visibility("PUBLIC")
                .priority(5)
                .peghi(2)
                .difficultyCount(3);
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields correctly")
        void build_success() {
            StorySummary s = validBuilder().build();

            assertAll("StorySummary fields",
                () -> assertEquals("uuid-1", s.getUuid()),
                () -> assertEquals("Title", s.getTitle()),
                () -> assertEquals("Description", s.getDescription()),
                () -> assertEquals("Author", s.getAuthor()),
                () -> assertEquals("adventure", s.getCategory()),
                () -> assertEquals("fantasy", s.getGroup()),
                () -> assertEquals("PUBLIC", s.getVisibility()),
                () -> assertEquals(5, s.getPriority()),
                () -> assertEquals(2, s.getPeghi()),
                () -> assertEquals(3, s.getDifficultyCount()),
                () -> assertTrue(s.toString().contains("uuid-1"))
            );
        }

        @Test
        @DisplayName("Should allow null for optional fields (title, description, author, etc.)")
        void build_optionalFieldsNull() {
            StorySummary s = StorySummary.builder()
                    .uuid("uuid-2")
                    .title(null)
                    .description(null)
                    .author(null)
                    .category(null)
                    .group(null)
                    .visibility(null)
                    .build();

            assertAll("Null optional fields",
                () -> assertNull(s.getTitle()),
                () -> assertNull(s.getDescription()),
                () -> assertNull(s.getAuthor()),
                () -> assertNull(s.getCategory()),
                () -> assertNull(s.getGroup()),
                () -> assertNull(s.getVisibility()),
                () -> assertEquals(0, s.getPriority()),
                () -> assertEquals(0, s.getPeghi()),
                () -> assertEquals(0, s.getDifficultyCount())
            );
        }
    }

    @Nested
    @DisplayName("Builder Validation Tests")
    class ValidationTests {

        @Test
        @DisplayName("Should throw IllegalStateException when uuid is null")
        void validate_nullUuid() {
            assertThrows(IllegalStateException.class, () ->
                    validBuilder().uuid(null).build());
        }

        @Test
        @DisplayName("Should throw IllegalStateException when uuid is blank")
        void validate_blankUuid() {
            assertThrows(IllegalStateException.class, () ->
                    validBuilder().uuid("  ").build());
        }

        @Test
        @DisplayName("Should throw IllegalStateException when uuid is empty")
        void validate_emptyUuid() {
            assertThrows(IllegalStateException.class, () ->
                    validBuilder().uuid("").build());
        }
    }
}
