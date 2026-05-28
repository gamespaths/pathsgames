package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the {@link TextInfo} record.
 */
class TextInfoTest {

    private TextInfo sample() {
        return new TextInfo(1, "it", "en", "Hello",
                "Hello World, this is a longer text.", "© 2026 Paths Games",
                "https://paths.games",
                new CreatorInfo("cr-1", "Author", null, null, null, null, null));
    }

    @Test
    @DisplayName("Canonical constructor maps all components")
    void constructor_mapsAllFields() {
        TextInfo ti = sample();
        assertAll(
            () -> assertEquals(1, ti.idText()),
            () -> assertEquals("it", ti.lang()),
            () -> assertEquals("en", ti.resolvedLang()),
            () -> assertEquals("Hello", ti.shortText()),
            () -> assertEquals("Hello World, this is a longer text.", ti.longText()),
            () -> assertEquals("© 2026 Paths Games", ti.copyrightText()),
            () -> assertEquals("https://paths.games", ti.linkCopyright()),
            () -> assertNotNull(ti.creator()),
            () -> assertEquals("cr-1", ti.creator().uuid())
        );
    }

    @Test
    @DisplayName("Allows null optional fields")
    void constructor_nullOptional() {
        TextInfo ti = new TextInfo(0, null, null, null, null, null, null, null);
        assertEquals(0, ti.idText());
        assertNull(ti.lang());
        assertNull(ti.creator());
    }

    @Test
    @DisplayName("equals/hashCode follow record value semantics")
    void valueSemantics() {
        assertEquals(sample(), sample());
        assertEquals(sample().hashCode(), sample().hashCode());
    }
}
