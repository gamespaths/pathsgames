package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link TextInfoResponse}.
 * Covers all-args constructor, no-arg constructor, and getters/setters.
 */
class TextInfoResponseTest {

    @Test
    @DisplayName("All-args constructor should set all fields")
    void allArgsConstructor() {
        CreatorInfoResponse creator = new CreatorInfoResponse(
                "cr-1", "Author", null, null, null, null, null);
        TextInfoResponse r = new TextInfoResponse(
                100, "it", "en", "Ciao", "Ciao Mondo",
                "© 2026", "https://copy.com", creator);

        assertAll("TextInfoResponse fields",
            () -> assertEquals(100, r.getIdText()),
            () -> assertEquals("it", r.getLang()),
            () -> assertEquals("en", r.getResolvedLang()),
            () -> assertEquals("Ciao", r.getShortText()),
            () -> assertEquals("Ciao Mondo", r.getLongText()),
            () -> assertEquals("© 2026", r.getCopyrightText()),
            () -> assertEquals("https://copy.com", r.getLinkCopyright()),
            () -> assertNotNull(r.getCreator()),
            () -> assertEquals("cr-1", r.getCreator().getUuid())
        );
    }

    @Test
    @DisplayName("No-arg constructor and setters should work")
    void noArgConstructorAndSetters() {
        TextInfoResponse r = new TextInfoResponse();
        r.setIdText(200);
        r.setLang("en");
        r.setResolvedLang("en");
        r.setShortText("Hello");
        r.setLongText("Hello World");
        r.setCopyrightText("© 2026");
        r.setLinkCopyright("https://copy.com");
        r.setCreator(null);

        assertAll("Setter values",
            () -> assertEquals(200, r.getIdText()),
            () -> assertEquals("en", r.getLang()),
            () -> assertEquals("en", r.getResolvedLang()),
            () -> assertEquals("Hello", r.getShortText()),
            () -> assertEquals("Hello World", r.getLongText()),
            () -> assertEquals("© 2026", r.getCopyrightText()),
            () -> assertEquals("https://copy.com", r.getLinkCopyright()),
            () -> assertNull(r.getCreator())
        );
    }
}
