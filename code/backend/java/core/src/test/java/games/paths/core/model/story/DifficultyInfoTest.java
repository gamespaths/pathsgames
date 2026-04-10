package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link DifficultyInfo}.
 * Validates builder logic, field defaults, and toString.
 */
@ExtendWith(MockitoExtension.class)
class DifficultyInfoTest {

    private DifficultyInfo.Builder validBuilder() {
        return DifficultyInfo.builder()
                .uuid("diff-1")
                .description("Easy")
                .expCost(5)
                .maxWeight(10)
                .minCharacter(1)
                .maxCharacter(4)
                .costHelpComa(3)
                .costMaxCharacteristics(3)
                .numberMaxFreeAction(1);
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            DifficultyInfo di = validBuilder().build();

            assertAll("DifficultyInfo fields",
                () -> assertEquals("diff-1", di.getUuid()),
                () -> assertEquals("Easy", di.getDescription()),
                () -> assertEquals(5, di.getExpCost()),
                () -> assertEquals(10, di.getMaxWeight()),
                () -> assertEquals(1, di.getMinCharacter()),
                () -> assertEquals(4, di.getMaxCharacter()),
                () -> assertEquals(3, di.getCostHelpComa()),
                () -> assertEquals(3, di.getCostMaxCharacteristics()),
                () -> assertEquals(1, di.getNumberMaxFreeAction()),
                () -> assertTrue(di.toString().contains("diff-1")),
                () -> assertTrue(di.toString().contains("5"))
            );
        }

        @Test
        @DisplayName("Should allow null uuid and description")
        void build_nullOptionalFields() {
            DifficultyInfo di = DifficultyInfo.builder()
                    .uuid(null)
                    .description(null)
                    .build();

            assertNull(di.getUuid());
            assertNull(di.getDescription());
        }

        @Test
        @DisplayName("Should default int fields to 0 when not set")
        void build_defaultIntFields() {
            DifficultyInfo di = DifficultyInfo.builder()
                    .uuid("uuid-test")
                    .build();

            assertAll("Default int values",
                () -> assertEquals(0, di.getExpCost()),
                () -> assertEquals(0, di.getMaxWeight()),
                () -> assertEquals(0, di.getMinCharacter()),
                () -> assertEquals(0, di.getMaxCharacter()),
                () -> assertEquals(0, di.getCostHelpComa()),
                () -> assertEquals(0, di.getCostMaxCharacteristics()),
                () -> assertEquals(0, di.getNumberMaxFreeAction())
            );
        }
    }
}
