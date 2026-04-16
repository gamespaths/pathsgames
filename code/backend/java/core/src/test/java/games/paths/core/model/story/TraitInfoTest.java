package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link TraitInfo}.
 * Validates builder logic, field defaults, nullable Integer fields, and toString.
 */
@ExtendWith(MockitoExtension.class)
class TraitInfoTest {

    private TraitInfo.Builder validBuilder() {
        return TraitInfo.builder()
                .uuid("trait-1")
                .name("Brave")
                .description("Fearless in battle")
                .costPositive(2)
                .costNegative(0)
                .idClassPermitted(1)
                .idClassProhibited(2);
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            TraitInfo ti = validBuilder().build();

            assertAll("TraitInfo fields",
                () -> assertEquals("trait-1", ti.getUuid()),
                () -> assertEquals("Brave", ti.getName()),
                () -> assertEquals("Fearless in battle", ti.getDescription()),
                () -> assertEquals(2, ti.getCostPositive()),
                () -> assertEquals(0, ti.getCostNegative()),
                () -> assertEquals(1, ti.getIdClassPermitted()),
                () -> assertEquals(2, ti.getIdClassProhibited()),
                () -> assertTrue(ti.toString().contains("trait-1")),
                () -> assertTrue(ti.toString().contains("Brave"))
            );
        }

        @Test
        @DisplayName("Should allow null uuid, name, and description")
        void build_nullOptionalFields() {
            TraitInfo ti = TraitInfo.builder()
                    .uuid(null)
                    .name(null)
                    .description(null)
                    .build();

            assertAll("Null fields",
                () -> assertNull(ti.getUuid()),
                () -> assertNull(ti.getName()),
                () -> assertNull(ti.getDescription())
            );
        }

        @Test
        @DisplayName("Should default int fields to 0 when not set")
        void build_defaultIntFields() {
            TraitInfo ti = TraitInfo.builder()
                    .uuid("uuid-test")
                    .build();

            assertAll("Default int values",
                () -> assertEquals(0, ti.getCostPositive()),
                () -> assertEquals(0, ti.getCostNegative())
            );
        }

        @Test
        @DisplayName("Should allow null idClassPermitted and idClassProhibited")
        void build_nullIntegerFields() {
            TraitInfo ti = TraitInfo.builder()
                    .uuid("trait-x")
                    .idClassPermitted(null)
                    .idClassProhibited(null)
                    .build();

            assertAll("Nullable Integer fields",
                () -> assertNull(ti.getIdClassPermitted()),
                () -> assertNull(ti.getIdClassProhibited())
            );
        }

        @Test
        @DisplayName("Should handle non-null idClassPermitted and idClassProhibited")
        void build_nonNullIntegerFields() {
            TraitInfo ti = TraitInfo.builder()
                    .uuid("trait-y")
                    .idClassPermitted(5)
                    .idClassProhibited(10)
                    .build();

            assertAll("Non-null Integer fields",
                () -> assertEquals(5, ti.getIdClassPermitted()),
                () -> assertEquals(10, ti.getIdClassProhibited())
            );
        }
    }
}
