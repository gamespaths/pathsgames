package games.paths.adapters.rest.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link CreatorInfoResponse}.
 * Covers all-args constructor, no-arg constructor, and getters/setters.
 */
class CreatorInfoResponseTest {

    @Test
    @DisplayName("All-args constructor should set all fields")
    void allArgsConstructor() {
        CreatorInfoResponse r = new CreatorInfoResponse(
                "cr-1", "John Doe", "https://link.com", "https://url.com",
                "https://img.com/avatar.png", "https://img.com/emote.png",
                "https://instagram.com/john");

        assertAll("CreatorInfoResponse fields",
            () -> assertEquals("cr-1", r.getUuid()),
            () -> assertEquals("John Doe", r.getName()),
            () -> assertEquals("https://link.com", r.getLink()),
            () -> assertEquals("https://url.com", r.getUrl()),
            () -> assertEquals("https://img.com/avatar.png", r.getUrlImage()),
            () -> assertEquals("https://img.com/emote.png", r.getUrlEmote()),
            () -> assertEquals("https://instagram.com/john", r.getUrlInstagram())
        );
    }

    @Test
    @DisplayName("No-arg constructor and setters should work")
    void noArgConstructorAndSetters() {
        CreatorInfoResponse r = new CreatorInfoResponse();
        r.setUuid("cr-2");
        r.setName("Jane Doe");
        r.setLink("https://link2.com");
        r.setUrl("https://url2.com");
        r.setUrlImage("https://img2.com/avatar.png");
        r.setUrlEmote("https://img2.com/emote.png");
        r.setUrlInstagram("https://instagram.com/jane");

        assertAll("Setter values",
            () -> assertEquals("cr-2", r.getUuid()),
            () -> assertEquals("Jane Doe", r.getName()),
            () -> assertEquals("https://link2.com", r.getLink()),
            () -> assertEquals("https://url2.com", r.getUrl()),
            () -> assertEquals("https://img2.com/avatar.png", r.getUrlImage()),
            () -> assertEquals("https://img2.com/emote.png", r.getUrlEmote()),
            () -> assertEquals("https://instagram.com/jane", r.getUrlInstagram())
        );
    }
}
