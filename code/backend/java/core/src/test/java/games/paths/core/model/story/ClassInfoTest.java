package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link ClassInfo}.
 * Validates builder logic, field defaults, and toString.
 */
@ExtendWith(MockitoExtension.class)
class ClassInfoTest {

    private ClassInfo.Builder validBuilder() {
        return ClassInfo.builder()
                .uuid("class-1")
                .name("Knight")
                .description("Noble warrior class")
                .weightMax(15)
                .dexterityBase(2)
                .intelligenceBase(1)
                .constitutionBase(3);
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            ClassInfo ci = validBuilder().build();

            assertAll("ClassInfo fields",
                () -> assertEquals("class-1", ci.getUuid()),
                () -> assertEquals("Knight", ci.getName()),
                () -> assertEquals("Noble warrior class", ci.getDescription()),
                () -> assertEquals(15, ci.getWeightMax()),
                () -> assertEquals(2, ci.getDexterityBase()),
                () -> assertEquals(1, ci.getIntelligenceBase()),
                () -> assertEquals(3, ci.getConstitutionBase()),
                () -> assertTrue(ci.toString().contains("class-1")),
                () -> assertTrue(ci.toString().contains("Knight"))
            );
        }

        @Test
        @DisplayName("Should allow null uuid, name, and description")
        void build_nullOptionalFields() {
            ClassInfo ci = ClassInfo.builder()
                    .uuid(null)
                    .name(null)
                    .description(null)
                    .build();

            assertAll("Null fields",
                () -> assertNull(ci.getUuid()),
                () -> assertNull(ci.getName()),
                () -> assertNull(ci.getDescription())
            );
        }

        @Test
        @DisplayName("Should default int fields to 0 when not set")
        void build_defaultIntFields() {
            ClassInfo ci = ClassInfo.builder()
                    .uuid("uuid-test")
                    .build();

            assertAll("Default int values",
                () -> assertEquals(0, ci.getWeightMax()),
                () -> assertEquals(0, ci.getDexterityBase()),
                () -> assertEquals(0, ci.getIntelligenceBase()),
                () -> assertEquals(0, ci.getConstitutionBase())
            );
        }
    }
}
