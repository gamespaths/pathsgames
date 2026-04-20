package games.paths.core.model.story;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link CreatorInfo}.
 * Validates builder logic, field defaults, and toString.
 */
@ExtendWith(MockitoExtension.class)
class CreatorInfoTest {

    private CreatorInfo.Builder validBuilder() {
        return CreatorInfo.builder()
                .uuid("creator-1")
                .name("John Doe")
                .link("https://example.com")
                .url("https://example.com/profile")
                .urlImage("https://example.com/avatar.png")
                .urlEmote("https://example.com/emote.png")
                .urlInstagram("https://instagram.com/johndoe");
    }

    @Nested
    @DisplayName("Creation and Mapping Tests")
    class CreationTests {

        @Test
        @DisplayName("Should build successfully and map all fields")
        void build_success() {
            CreatorInfo ci = validBuilder().build();

            assertAll("CreatorInfo fields",
                () -> assertEquals("creator-1", ci.getUuid()),
                () -> assertEquals("John Doe", ci.getName()),
                () -> assertEquals("https://example.com", ci.getLink()),
                () -> assertEquals("https://example.com/profile", ci.getUrl()),
                () -> assertEquals("https://example.com/avatar.png", ci.getUrlImage()),
                () -> assertEquals("https://example.com/emote.png", ci.getUrlEmote()),
                () -> assertEquals("https://instagram.com/johndoe", ci.getUrlInstagram()),
                () -> assertTrue(ci.toString().contains("creator-1")),
                () -> assertTrue(ci.toString().contains("John Doe"))
            );
        }

        @Test
        @DisplayName("Should allow all null fields")
        void build_allNullFields() {
            CreatorInfo ci = CreatorInfo.builder()
                    .uuid(null)
                    .name(null)
                    .link(null)
                    .url(null)
                    .urlImage(null)
                    .urlEmote(null)
                    .urlInstagram(null)
                    .build();

            assertAll("All null fields",
                () -> assertNull(ci.getUuid()),
                () -> assertNull(ci.getName()),
                () -> assertNull(ci.getLink()),
                () -> assertNull(ci.getUrl()),
                () -> assertNull(ci.getUrlImage()),
                () -> assertNull(ci.getUrlEmote()),
                () -> assertNull(ci.getUrlInstagram())
            );
        }

        @Test
        @DisplayName("Should default all fields to null when not set")
        void build_defaultFields() {
            CreatorInfo ci = CreatorInfo.builder().build();

            assertAll("Default values",
                () -> assertNull(ci.getUuid()),
                () -> assertNull(ci.getName()),
                () -> assertNull(ci.getLink()),
                () -> assertNull(ci.getUrl()),
                () -> assertNull(ci.getUrlImage()),
                () -> assertNull(ci.getUrlEmote()),
                () -> assertNull(ci.getUrlInstagram())
            );
        }
    }
}
