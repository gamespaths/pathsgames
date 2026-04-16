package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link StoryDetail}.
 * Validates builder logic, mandatory fields, list immutability, and defaults.
 */
@ExtendWith(MockitoExtension.class)
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
                () -> assertEquals("uuid-1", d.getUuid()),
                () -> assertEquals("Title", d.getTitle()),
                () -> assertEquals("Description", d.getDescription()),
                () -> assertEquals("Author", d.getAuthor()),
                () -> assertEquals("adventure", d.getCategory()),
                () -> assertEquals("fantasy", d.getGroup()),
                () -> assertEquals("PUBLIC", d.getVisibility()),
                () -> assertEquals(5, d.getPriority()),
                () -> assertEquals(2, d.getPeghi()),
                () -> assertEquals("0.10", d.getVersionMin()),
                () -> assertEquals("1.0", d.getVersionMax()),
                () -> assertEquals("hour", d.getClockSingularDescription()),
                () -> assertEquals("hours", d.getClockPluralDescription()),
                () -> assertEquals("Copyright", d.getCopyrightText()),
                () -> assertEquals("https://example.com", d.getLinkCopyright()),
                () -> assertEquals(10, d.getLocationCount()),
                () -> assertEquals(20, d.getEventCount()),
                () -> assertEquals(5, d.getItemCount()),
                () -> assertEquals(1, d.getDifficulties().size()),
                () -> assertEquals("Easy", d.getDifficulties().get(0).getDescription()),
                () -> assertTrue(d.toString().contains("uuid-1"))
            );
        }

        @Test
        @DisplayName("Should default difficulties to empty list when null")
        void build_nullDifficulties() {
            StoryDetail d = validBuilder().difficulties(null).build();

            assertNotNull(d.getDifficulties());
            assertTrue(d.getDifficulties().isEmpty());
        }

        @Test
        @DisplayName("Difficulties list should be immutable")
        void build_immutableDifficulties() {
            StoryDetail d = validBuilder().build();

            assertThrows(UnsupportedOperationException.class, () ->
                    d.getDifficulties().add(DifficultyInfo.builder().uuid("x").build()));
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
                () -> assertNull(d.getTitle()),
                () -> assertNull(d.getDescription()),
                () -> assertNull(d.getAuthor()),
                () -> assertNull(d.getVersionMin()),
                () -> assertNull(d.getVersionMax()),
                () -> assertNull(d.getCopyrightText())
            );
        }

        // --- Step 15: Character templates, classes, traits, card, counts ---

        @Test
        @DisplayName("Should build with characterTemplates, classes, traits, card, and counts")
        void build_step15Fields() {
            CharacterTemplateInfo ct = CharacterTemplateInfo.builder()
                    .uuid("ct-1").name("Warrior").build();
            ClassInfo ci = ClassInfo.builder()
                    .uuid("class-1").name("Knight").build();
            TraitInfo ti = TraitInfo.builder()
                    .uuid("trait-1").name("Brave").build();
            CardInfo card = CardInfo.builder()
                    .uuid("card-1").imageUrl("https://example.com/card.png").build();

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
                () -> assertEquals(1, d.getClassCount()),
                () -> assertEquals(1, d.getCharacterTemplateCount()),
                () -> assertEquals(1, d.getTraitCount()),
                () -> assertEquals(1, d.getCharacterTemplates().size()),
                () -> assertEquals("ct-1", d.getCharacterTemplates().get(0).getUuid()),
                () -> assertEquals(1, d.getClasses().size()),
                () -> assertEquals("class-1", d.getClasses().get(0).getUuid()),
                () -> assertEquals(1, d.getTraits().size()),
                () -> assertEquals("trait-1", d.getTraits().get(0).getUuid()),
                () -> assertNotNull(d.getCard()),
                () -> assertEquals("card-1", d.getCard().getUuid())
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
                () -> assertNotNull(d.getCharacterTemplates()),
                () -> assertTrue(d.getCharacterTemplates().isEmpty()),
                () -> assertNotNull(d.getClasses()),
                () -> assertTrue(d.getClasses().isEmpty()),
                () -> assertNotNull(d.getTraits()),
                () -> assertTrue(d.getTraits().isEmpty()),
                () -> assertNull(d.getCard())
            );
        }

        @Test
        @DisplayName("Character templates list should be immutable")
        void build_immutableCharacterTemplates() {
            StoryDetail d = validBuilder().characterTemplates(List.of()).build();

            assertThrows(UnsupportedOperationException.class, () ->
                    d.getCharacterTemplates().add(CharacterTemplateInfo.builder().uuid("x").build()));
        }

        @Test
        @DisplayName("Classes list should be immutable")
        void build_immutableClasses() {
            StoryDetail d = validBuilder().classes(List.of()).build();

            assertThrows(UnsupportedOperationException.class, () ->
                    d.getClasses().add(ClassInfo.builder().uuid("x").build()));
        }

        @Test
        @DisplayName("Traits list should be immutable")
        void build_immutableTraits() {
            StoryDetail d = validBuilder().traits(List.of()).build();

            assertThrows(UnsupportedOperationException.class, () ->
                    d.getTraits().add(TraitInfo.builder().uuid("x").build()));
        }

        @Test
        @DisplayName("Should default count fields to 0 when not set")
        void build_defaultCounts() {
            StoryDetail d = validBuilder().build();

            assertAll("Default counts",
                () -> assertEquals(0, d.getClassCount()),
                () -> assertEquals(0, d.getCharacterTemplateCount()),
                () -> assertEquals(0, d.getTraitCount())
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
