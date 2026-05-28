package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link StoryDetail}.
 * Validates the nested builder, mandatory fields, list immutability, and defaults.
 */
class StoryDetailTest {

    private StoryDetail.Builder validBuilder() {
        return StoryDetail.builder()
                .uuid("uuid-1")
                .title("Title")
                .description("Description")
                .author("Author")
                .category("adventure")
                .group("fantasy")
                .visibility("PUBLIC")
                .priority(5)
                .peghi(2)
                .versionMin("0.10")
                .versionMax("1.0")
                .clockSingularDescription("hour")
                .clockPluralDescription("hours")
                .copyrightText("Copyright")
                .linkCopyright("https://example.com")
                .locationCount(10)
                .eventCount(20)
                .itemCount(5)
                .difficulties(List.of());
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            DifficultyInfo diff = DifficultyInfo.builder()
                    .uuid("diff-1")
                    .description("Easy")
                    .expCost(5)
                    .maxWeight(10)
                    .minCharacter(1)
                    .maxCharacter(4)
                    .costHelpComa(3)
                    .costMaxCharacteristics(3)
                    .numberMaxFreeAction(1)
                    .build();

            StoryDetail d = validBuilder().difficulties(List.of(diff)).build();

            assertAll("StoryDetail fields",
                () -> assertEquals("uuid-1", d.uuid()),
                () -> assertEquals("Title", d.title()),
                () -> assertEquals("Description", d.description()),
                () -> assertEquals("Author", d.author()),
                () -> assertEquals("adventure", d.category()),
                () -> assertEquals("fantasy", d.group()),
                () -> assertEquals("PUBLIC", d.visibility()),
                () -> assertEquals(5, d.priority()),
                () -> assertEquals(2, d.peghi()),
                () -> assertEquals("0.10", d.versionMin()),
                () -> assertEquals("1.0", d.versionMax()),
                () -> assertEquals("hour", d.clockSingularDescription()),
                () -> assertEquals("hours", d.clockPluralDescription()),
                () -> assertEquals("Copyright", d.copyrightText()),
                () -> assertEquals("https://example.com", d.linkCopyright()),
                () -> assertEquals(10, d.locationCount()),
                () -> assertEquals(20, d.eventCount()),
                () -> assertEquals(5, d.itemCount()),
                () -> assertEquals(1, d.difficulties().size()),
                () -> assertEquals("Easy", d.difficulties().get(0).getDescription())
            );
        }

        @Test
        @DisplayName("Should default difficulties to empty list when null")
        void build_nullDifficulties() {
            StoryDetail d = validBuilder().difficulties(null).build();

            assertNotNull(d.difficulties());
            assertTrue(d.difficulties().isEmpty());
        }

        @Test
        @DisplayName("Difficulties list should be immutable")
        void build_immutableDifficulties() {
            StoryDetail d = validBuilder().build();

            assertThrows(UnsupportedOperationException.class, () ->
                    d.difficulties().add(DifficultyInfo.builder().uuid("x").build()));
        }

        @Test
        @DisplayName("Should allow null for optional string fields")
        void build_optionalFieldsNull() {
            StoryDetail d = StoryDetail.builder()
                    .uuid("uuid-2")
                    .title(null)
                    .description(null)
                    .author(null)
                    .versionMin(null)
                    .versionMax(null)
                    .copyrightText(null)
                    .build();

            assertAll("Null optional fields",
                () -> assertNull(d.title()),
                () -> assertNull(d.description()),
                () -> assertNull(d.author()),
                () -> assertNull(d.versionMin()),
                () -> assertNull(d.versionMax()),
                () -> assertNull(d.copyrightText())
            );
        }

        @Test
        @DisplayName("Should build with characterTemplates, classes, traits, card, and counts")
        void build_step15Fields() {
            CharacterTemplateInfo ct = new CharacterTemplateInfo("ct-1", "Warrior", null,
                    0, 0, 0, 0, 0, 0, null, null, null, null);
            ClassInfo ci = new ClassInfo(null, "class-1", "Knight", null,
                    0, 0, 0, 0, null, null, List.of());
            TraitInfo ti = TraitInfo.builder().uuid("trait-1").name("Brave").build();
            CardInfo card = new CardInfo("card-1", null, "https://example.com/card.png",
                    null, null, null, null, null, null, null, null, null, null, null, null);

            StoryDetail d = validBuilder()
                    .classCount(1)
                    .characterTemplateCount(1)
                    .traitCount(1)
                    .characterTemplates(List.of(ct))
                    .classes(List.of(ci))
                    .traits(List.of(ti))
                    .card(card)
                    .build();

            assertAll("Step 15 fields",
                () -> assertEquals(1, d.classCount()),
                () -> assertEquals(1, d.characterTemplateCount()),
                () -> assertEquals(1, d.traitCount()),
                () -> assertEquals(1, d.characterTemplates().size()),
                () -> assertEquals("ct-1", d.characterTemplates().get(0).uuid()),
                () -> assertEquals(1, d.classes().size()),
                () -> assertEquals("class-1", d.classes().get(0).uuid()),
                () -> assertEquals(1, d.traits().size()),
                () -> assertEquals("trait-1", d.traits().get(0).getUuid()),
                () -> assertNotNull(d.card()),
                () -> assertEquals("card-1", d.card().uuid())
            );
        }

        @Test
        @DisplayName("Should default new lists to empty when null")
        void build_nullStep15Lists() {
            StoryDetail d = validBuilder()
                    .characterTemplates(null)
                    .classes(null)
                    .traits(null)
                    .card(null)
                    .build();

            assertAll("Null Step 15 lists default to empty",
                () -> assertNotNull(d.characterTemplates()),
                () -> assertTrue(d.characterTemplates().isEmpty()),
                () -> assertNotNull(d.classes()),
                () -> assertTrue(d.classes().isEmpty()),
                () -> assertNotNull(d.traits()),
                () -> assertTrue(d.traits().isEmpty()),
                () -> assertNull(d.card())
            );
        }

        @Test
        @DisplayName("Should default count fields to 0 when not set")
        void build_defaultCounts() {
            StoryDetail d = validBuilder().build();

            assertAll("Default counts",
                () -> assertEquals(0, d.classCount()),
                () -> assertEquals(0, d.characterTemplateCount()),
                () -> assertEquals(0, d.traitCount())
            );
        }
    }

    @Nested
    @DisplayName("Builder Validation Tests")
    class ValidationTests {

        @Test
        @DisplayName("Should throw IllegalStateException when uuid is null/blank/empty")
        void validate_invalidUuid() {
            assertThrows(IllegalStateException.class, () -> validBuilder().uuid(null).build());
            assertThrows(IllegalStateException.class, () -> validBuilder().uuid("  ").build());
            assertThrows(IllegalStateException.class, () -> validBuilder().uuid("").build());
        }
    }
}
