package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link TextInfo}.
 * Validates builder logic, field defaults, and toString.
 */
@ExtendWith(MockitoExtension.class)
class TextInfoTest {

    private TextInfo.Builder validBuilder() {
        return TextInfo.builder()
                .idText(1)
                .lang("it")
                .resolvedLang("en")
                .shortText("Hello")
                .longText("Hello World, this is a longer text.")
                .copyrightText("© 2026 Paths Games")
                .linkCopyright("https://paths.games")
                .creator(CreatorInfo.builder().uuid("cr-1").name("Author").build());
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            TextInfo ti = validBuilder().build();

            assertAll("TextInfo fields",
                () -> assertEquals(1, ti.getIdText()),
                () -> assertEquals("it", ti.getLang()),
                () -> assertEquals("en", ti.getResolvedLang()),
                () -> assertEquals("Hello", ti.getShortText()),
                () -> assertEquals("Hello World, this is a longer text.", ti.getLongText()),
                () -> assertEquals("© 2026 Paths Games", ti.getCopyrightText()),
                () -> assertEquals("https://paths.games", ti.getLinkCopyright()),
                () -> assertNotNull(ti.getCreator()),
                () -> assertEquals("cr-1", ti.getCreator().getUuid()),
                () -> assertTrue(ti.toString().contains("idText=1")),
                () -> assertTrue(ti.toString().contains("lang='it'")),
                () -> assertTrue(ti.toString().contains("resolvedLang='en'"))
            );
        }

        @Test
        @DisplayName("Should allow null optional fields")
        void build_nullOptionalFields() {
            TextInfo ti = TextInfo.builder()
                    .idText(0)
                    .lang(null)
                    .resolvedLang(null)
                    .shortText(null)
                    .longText(null)
                    .copyrightText(null)
                    .linkCopyright(null)
                    .creator(null)
                    .build();

            assertAll("Null optional fields",
                () -> assertEquals(0, ti.getIdText()),
                () -> assertNull(ti.getLang()),
                () -> assertNull(ti.getResolvedLang()),
                () -> assertNull(ti.getShortText()),
                () -> assertNull(ti.getLongText()),
                () -> assertNull(ti.getCopyrightText()),
                () -> assertNull(ti.getLinkCopyright()),
                () -> assertNull(ti.getCreator())
            );
        }

        @Test
        @DisplayName("Should default fields when not set")
        void build_defaultFields() {
            TextInfo ti = TextInfo.builder().build();

            assertAll("Default values",
                () -> assertEquals(0, ti.getIdText()),
                () -> assertNull(ti.getLang()),
                () -> assertNull(ti.getResolvedLang()),
                () -> assertNull(ti.getShortText()),
                () -> assertNull(ti.getLongText()),
                () -> assertNull(ti.getCopyrightText()),
                () -> assertNull(ti.getLinkCopyright()),
                () -> assertNull(ti.getCreator())
            );
        }
    }
}
