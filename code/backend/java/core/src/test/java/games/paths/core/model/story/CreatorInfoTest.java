package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for the {@link CreatorInfo} record.
 */
class CreatorInfoTest {

    @Test
    @DisplayName("Canonical constructor maps all components")
    void constructor_mapsAllFields() {
        CreatorInfo ci = new CreatorInfo("creator-1", "John Doe", "https://example.com",
                "https://example.com/profile", "https://example.com/avatar.png",
                "https://example.com/emote.png", "https://instagram.com/johndoe");

        assertAll(
            () -> assertEquals("creator-1", ci.uuid()),
            () -> assertEquals("John Doe", ci.name()),
            () -> assertEquals("https://example.com", ci.link()),
            () -> assertEquals("https://example.com/profile", ci.url()),
            () -> assertEquals("https://example.com/avatar.png", ci.urlImage()),
            () -> assertEquals("https://example.com/emote.png", ci.urlEmote()),
            () -> assertEquals("https://instagram.com/johndoe", ci.urlInstagram())
        );
    }

    @Test
    @DisplayName("Allows all null fields")
    void constructor_allNull() {
        CreatorInfo ci = new CreatorInfo(null, null, null, null, null, null, null);
        assertNull(ci.uuid());
        assertNull(ci.name());
    }

    @Test
    @DisplayName("equals/hashCode follow record value semantics")
    void valueSemantics() {
        CreatorInfo a = new CreatorInfo("u", "n", null, null, null, null, null);
        CreatorInfo b = new CreatorInfo("u", "n", null, null, null, null, null);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }
}
