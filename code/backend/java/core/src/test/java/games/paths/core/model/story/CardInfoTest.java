package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link CardInfo}.
 * Validates builder logic, field defaults, and toString.
 */
@ExtendWith(MockitoExtension.class)
class CardInfoTest {

    private CardInfo.Builder validBuilder() {
        return CardInfo.builder()
                .uuid("card-1")
                .imageUrl("https://example.com/card.png")
                .alternativeImage("alt-text")
                .awesomeIcon("fa-star")
                .styleMain("bg-primary")
                .styleDetail("text-light")
                .title("Card Title")
                .description("Card Description")
                .copyrightText("© 2026")
                .linkCopyright("https://example.com")
                .creator(CreatorInfo.builder().uuid("cr-1").name("Author").build());
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            CardInfo ci = validBuilder().build();

            assertAll("CardInfo fields",
                () -> assertEquals("card-1", ci.getUuid()),
                () -> assertEquals("https://example.com/card.png", ci.getImageUrl()),
                () -> assertEquals("alt-text", ci.getAlternativeImage()),
                () -> assertEquals("fa-star", ci.getAwesomeIcon()),
                () -> assertEquals("bg-primary", ci.getStyleMain()),
                () -> assertEquals("text-light", ci.getStyleDetail()),
                () -> assertEquals("Card Title", ci.getTitle()),
                () -> assertEquals("Card Description", ci.getDescription()),
                () -> assertEquals("© 2026", ci.getCopyrightText()),
                () -> assertEquals("https://example.com", ci.getLinkCopyright()),
                () -> assertNotNull(ci.getCreator()),
                () -> assertEquals("cr-1", ci.getCreator().getUuid()),
                () -> assertTrue(ci.toString().contains("card-1")),
                () -> assertTrue(ci.toString().contains("https://example.com/card.png"))
            );
        }

        @Test
        @DisplayName("Should allow all null fields")
        void build_allNullFields() {
            CardInfo ci = CardInfo.builder()
                    .uuid(null)
                    .imageUrl(null)
                    .alternativeImage(null)
                    .awesomeIcon(null)
                    .styleMain(null)
                    .styleDetail(null)
                    .title(null)
                    .description(null)
                    .copyrightText(null)
                    .linkCopyright(null)
                    .creator(null)
                    .build();

            assertAll("All null fields",
                () -> assertNull(ci.getUuid()),
                () -> assertNull(ci.getImageUrl()),
                () -> assertNull(ci.getAlternativeImage()),
                () -> assertNull(ci.getAwesomeIcon()),
                () -> assertNull(ci.getStyleMain()),
                () -> assertNull(ci.getStyleDetail()),
                () -> assertNull(ci.getTitle()),
                () -> assertNull(ci.getDescription()),
                () -> assertNull(ci.getCopyrightText()),
                () -> assertNull(ci.getLinkCopyright()),
                () -> assertNull(ci.getCreator())
            );
        }

        @Test
        @DisplayName("Should default all fields to null when not set")
        void build_defaultFields() {
            CardInfo ci = CardInfo.builder().build();

            assertAll("Default values",
                () -> assertNull(ci.getUuid()),
                () -> assertNull(ci.getImageUrl()),
                () -> assertNull(ci.getAlternativeImage()),
                () -> assertNull(ci.getAwesomeIcon()),
                () -> assertNull(ci.getStyleMain()),
                () -> assertNull(ci.getStyleDetail()),
                () -> assertNull(ci.getTitle()),
                () -> assertNull(ci.getDescription()),
                () -> assertNull(ci.getCopyrightText()),
                () -> assertNull(ci.getLinkCopyright()),
                () -> assertNull(ci.getCreator())
            );
        }
    }
}
