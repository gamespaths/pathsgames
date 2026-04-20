package games.paths.adapters.rest.controller.story;

import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CreatorInfo;
import games.paths.core.model.story.TextInfo;
import games.paths.core.port.story.ContentQueryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link ContentController}.
 * Uses MockMvc with standaloneSetup (no Spring context).
 * Tests all card, text, and creator content endpoints
 * including success, not found, language parameter handling,
 * and response structure validation.
 *
 * <p>Added in Step 16.</p>
 */
class ContentControllerTest {

    private MockMvc mockMvc;
    private ContentQueryPort contentQueryPort;

    @BeforeEach
    void setup() {
        contentQueryPort = mock(ContentQueryPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new ContentController(contentQueryPort)).build();
    }

    // === Helper builders ===

    private CreatorInfo sampleCreator() {
        return CreatorInfo.builder()
                .uuid("cr-uuid")
                .name("Author Name")
                .link("https://creator.com")
                .url("https://creator.com/profile")
                .urlImage("https://creator.com/avatar.png")
                .urlEmote("https://creator.com/emote.png")
                .urlInstagram("https://instagram.com/creator")
                .build();
    }

    private CardInfo sampleCard() {
        return CardInfo.builder()
                .uuid("card-uuid")
                .imageUrl("https://img.com/card.png")
                .alternativeImage("alt.jpg")
                .awesomeIcon("fa-star")
                .styleMain("bg-primary")
                .styleDetail("text-light")
                .title("Card Title")
                .description("Card Description")
                .copyrightText("© 2026")
                .linkCopyright("https://copy.com")
                .creator(sampleCreator())
                .build();
    }

    private TextInfo sampleText() {
        return TextInfo.builder()
                .idText(100)
                .lang("it")
                .resolvedLang("en")
                .shortText("Hello")
                .longText("Hello World")
                .copyrightText("© 2026")
                .linkCopyright("https://copy.com")
                .creator(sampleCreator())
                .build();
    }

    // === GET /api/content/{uuidStory}/cards/{uuidCard} ===

    @Nested
    @DisplayName("GET /api/content/{uuidStory}/cards/{uuidCard}")
    class GetCard {

        @Test
        @DisplayName("Should return 200 with full card detail")
        void success() throws Exception {
            when(contentQueryPort.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en"))
                    .thenReturn(sampleCard());

            mockMvc.perform(get("/api/content/story-uuid/cards/card-uuid"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.uuid").value("card-uuid"))
                    .andExpect(jsonPath("$.imageUrl").value("https://img.com/card.png"))
                    .andExpect(jsonPath("$.alternativeImage").value("alt.jpg"))
                    .andExpect(jsonPath("$.awesomeIcon").value("fa-star"))
                    .andExpect(jsonPath("$.styleMain").value("bg-primary"))
                    .andExpect(jsonPath("$.styleDetail").value("text-light"))
                    .andExpect(jsonPath("$.title").value("Card Title"))
                    .andExpect(jsonPath("$.description").value("Card Description"))
                    .andExpect(jsonPath("$.copyrightText").value("© 2026"))
                    .andExpect(jsonPath("$.linkCopyright").value("https://copy.com"))
                    .andExpect(jsonPath("$.creator.uuid").value("cr-uuid"))
                    .andExpect(jsonPath("$.creator.name").value("Author Name"));
        }

        @Test
        @DisplayName("Should return 404 when card not found")
        void notFound() throws Exception {
            when(contentQueryPort.getCardByStoryAndCardUuid("story-uuid", "unknown", "en"))
                    .thenReturn(null);

            mockMvc.perform(get("/api/content/story-uuid/cards/unknown"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("CARD_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").exists());
        }

        @Test
        @DisplayName("Should pass lang parameter to port")
        void withLang() throws Exception {
            when(contentQueryPort.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "it"))
                    .thenReturn(sampleCard());

            mockMvc.perform(get("/api/content/story-uuid/cards/card-uuid").param("lang", "it"))
                    .andExpect(status().isOk());

            verify(contentQueryPort).getCardByStoryAndCardUuid("story-uuid", "card-uuid", "it");
        }

        @Test
        @DisplayName("Should default to 'en' when no lang parameter")
        void defaultLang() throws Exception {
            when(contentQueryPort.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en"))
                    .thenReturn(sampleCard());

            mockMvc.perform(get("/api/content/story-uuid/cards/card-uuid"))
                    .andExpect(status().isOk());

            verify(contentQueryPort).getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en");
        }

        @Test
        @DisplayName("Should return card with null creator when creator is null")
        void nullCreator() throws Exception {
            CardInfo card = CardInfo.builder()
                    .uuid("card-uuid")
                    .title("Card Title")
                    .creator(null)
                    .build();

            when(contentQueryPort.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en"))
                    .thenReturn(card);

            mockMvc.perform(get("/api/content/story-uuid/cards/card-uuid"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.uuid").value("card-uuid"))
                    .andExpect(jsonPath("$.creator").doesNotExist());
        }

        @Test
        @DisplayName("Should return JSON content type")
        void jsonContentType() throws Exception {
            when(contentQueryPort.getCardByStoryAndCardUuid("story-uuid", "card-uuid", "en"))
                    .thenReturn(sampleCard());

            mockMvc.perform(get("/api/content/story-uuid/cards/card-uuid"))
                    .andExpect(content().contentTypeCompatibleWith("application/json"));
        }
    }

    // === GET /api/content/{uuidStory}/texts/{idText}/lang/{lang} ===

    @Nested
    @DisplayName("GET /api/content/{uuidStory}/texts/{idText}/lang/{lang}")
    class GetText {

        @Test
        @DisplayName("Should return 200 with full text info")
        void success() throws Exception {
            when(contentQueryPort.getTextByStoryAndIdText("story-uuid", 100, "it"))
                    .thenReturn(sampleText());

            mockMvc.perform(get("/api/content/story-uuid/texts/100/lang/it"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.idText").value(100))
                    .andExpect(jsonPath("$.lang").value("it"))
                    .andExpect(jsonPath("$.resolvedLang").value("en"))
                    .andExpect(jsonPath("$.shortText").value("Hello"))
                    .andExpect(jsonPath("$.longText").value("Hello World"))
                    .andExpect(jsonPath("$.copyrightText").value("© 2026"))
                    .andExpect(jsonPath("$.linkCopyright").value("https://copy.com"))
                    .andExpect(jsonPath("$.creator.uuid").value("cr-uuid"));
        }

        @Test
        @DisplayName("Should return 404 when text not found")
        void notFound() throws Exception {
            when(contentQueryPort.getTextByStoryAndIdText("story-uuid", 999, "en"))
                    .thenReturn(null);

            mockMvc.perform(get("/api/content/story-uuid/texts/999/lang/en"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("TEXT_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").exists());
        }

        @Test
        @DisplayName("Should pass lang path variable to port")
        void langPathVar() throws Exception {
            when(contentQueryPort.getTextByStoryAndIdText("story-uuid", 100, "fr"))
                    .thenReturn(sampleText());

            mockMvc.perform(get("/api/content/story-uuid/texts/100/lang/fr"))
                    .andExpect(status().isOk());

            verify(contentQueryPort).getTextByStoryAndIdText("story-uuid", 100, "fr");
        }

        @Test
        @DisplayName("Should return text with null creator when creator is null")
        void nullCreator() throws Exception {
            TextInfo text = TextInfo.builder()
                    .idText(100)
                    .lang("en")
                    .resolvedLang("en")
                    .shortText("Hello")
                    .creator(null)
                    .build();

            when(contentQueryPort.getTextByStoryAndIdText("story-uuid", 100, "en"))
                    .thenReturn(text);

            mockMvc.perform(get("/api/content/story-uuid/texts/100/lang/en"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.idText").value(100))
                    .andExpect(jsonPath("$.creator").doesNotExist());
        }

        @Test
        @DisplayName("Should return JSON content type")
        void jsonContentType() throws Exception {
            when(contentQueryPort.getTextByStoryAndIdText("story-uuid", 100, "en"))
                    .thenReturn(sampleText());

            mockMvc.perform(get("/api/content/story-uuid/texts/100/lang/en"))
                    .andExpect(content().contentTypeCompatibleWith("application/json"));
        }
    }

    // === GET /api/content/{uuidStory}/creators/{uuidCreator} ===

    @Nested
    @DisplayName("GET /api/content/{uuidStory}/creators/{uuidCreator}")
    class GetCreator {

        @Test
        @DisplayName("Should return 200 with full creator detail")
        void success() throws Exception {
            when(contentQueryPort.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "en"))
                    .thenReturn(sampleCreator());

            mockMvc.perform(get("/api/content/story-uuid/creators/cr-uuid"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.uuid").value("cr-uuid"))
                    .andExpect(jsonPath("$.name").value("Author Name"))
                    .andExpect(jsonPath("$.link").value("https://creator.com"))
                    .andExpect(jsonPath("$.url").value("https://creator.com/profile"))
                    .andExpect(jsonPath("$.urlImage").value("https://creator.com/avatar.png"))
                    .andExpect(jsonPath("$.urlEmote").value("https://creator.com/emote.png"))
                    .andExpect(jsonPath("$.urlInstagram").value("https://instagram.com/creator"));
        }

        @Test
        @DisplayName("Should return 404 when creator not found")
        void notFound() throws Exception {
            when(contentQueryPort.getCreatorByStoryAndCreatorUuid("story-uuid", "unknown", "en"))
                    .thenReturn(null);

            mockMvc.perform(get("/api/content/story-uuid/creators/unknown"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("CREATOR_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").exists());
        }

        @Test
        @DisplayName("Should pass lang parameter to port")
        void withLang() throws Exception {
            when(contentQueryPort.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "it"))
                    .thenReturn(sampleCreator());

            mockMvc.perform(get("/api/content/story-uuid/creators/cr-uuid").param("lang", "it"))
                    .andExpect(status().isOk());

            verify(contentQueryPort).getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "it");
        }

        @Test
        @DisplayName("Should default to 'en' when no lang parameter")
        void defaultLang() throws Exception {
            when(contentQueryPort.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "en"))
                    .thenReturn(sampleCreator());

            mockMvc.perform(get("/api/content/story-uuid/creators/cr-uuid"))
                    .andExpect(status().isOk());

            verify(contentQueryPort).getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "en");
        }

        @Test
        @DisplayName("Should return creator with null fields when URLs are null")
        void nullUrls() throws Exception {
            CreatorInfo creator = CreatorInfo.builder()
                    .uuid("cr-uuid")
                    .name("Author")
                    .build();

            when(contentQueryPort.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "en"))
                    .thenReturn(creator);

            mockMvc.perform(get("/api/content/story-uuid/creators/cr-uuid"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.uuid").value("cr-uuid"))
                    .andExpect(jsonPath("$.name").value("Author"))
                    .andExpect(jsonPath("$.link").doesNotExist())
                    .andExpect(jsonPath("$.urlImage").doesNotExist());
        }

        @Test
        @DisplayName("Should return JSON content type")
        void jsonContentType() throws Exception {
            when(contentQueryPort.getCreatorByStoryAndCreatorUuid("story-uuid", "cr-uuid", "en"))
                    .thenReturn(sampleCreator());

            mockMvc.perform(get("/api/content/story-uuid/creators/cr-uuid"))
                    .andExpect(content().contentTypeCompatibleWith("application/json"));
        }
    }
}
