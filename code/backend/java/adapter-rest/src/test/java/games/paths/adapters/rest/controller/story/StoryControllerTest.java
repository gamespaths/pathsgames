package games.paths.adapters.rest.controller.story;

import games.paths.core.model.story.DifficultyInfo;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.StorySummary;
import games.paths.core.port.story.StoryQueryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link StoryController}.
 * Uses MockMvc with standaloneSetup (no Spring context).
 */
class StoryControllerTest {

    private MockMvc mockMvc;
    private StoryQueryPort storyQueryPort;

    @BeforeEach
    void setup() {
        storyQueryPort = mock(StoryQueryPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new StoryController(storyQueryPort)).build();
    }

    // === GET /api/stories ===

    @Nested
    @DisplayName("GET /api/stories")
    class ListStories {

        @Test
        @DisplayName("Should return 200 with empty list when no public stories")
        void listStories_empty() throws Exception {
            when(storyQueryPort.listPublicStories("en")).thenReturn(List.of());

            mockMvc.perform(get("/api/stories"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("Should return 200 with list of story summaries")
        void listStories_withResults() throws Exception {
            StorySummary s1 = StorySummary.builder()
                    .uuid("uuid-1").title("Story One").description("Desc 1")
                    .author("Author1").category("adventure").group("fantasy")
                    .visibility("PUBLIC").priority(5).peghi(2).difficultyCount(3)
                    .build();
            StorySummary s2 = StorySummary.builder()
                    .uuid("uuid-2").title("Story Two").description("Desc 2")
                    .author("Author2").category("horror").group("dark")
                    .visibility("PUBLIC").priority(3).peghi(1).difficultyCount(1)
                    .build();

            when(storyQueryPort.listPublicStories("en")).thenReturn(List.of(s1, s2));

            mockMvc.perform(get("/api/stories"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[0].uuid").value("uuid-1"))
                    .andExpect(jsonPath("$[0].title").value("Story One"))
                    .andExpect(jsonPath("$[0].author").value("Author1"))
                    .andExpect(jsonPath("$[0].priority").value(5))
                    .andExpect(jsonPath("$[0].difficultyCount").value(3))
                    .andExpect(jsonPath("$[1].uuid").value("uuid-2"))
                    .andExpect(jsonPath("$[1].title").value("Story Two"));
        }

        @Test
        @DisplayName("Should pass lang parameter to port")
        void listStories_withLang() throws Exception {
            when(storyQueryPort.listPublicStories("it")).thenReturn(List.of());

            mockMvc.perform(get("/api/stories").param("lang", "it"))
                    .andExpect(status().isOk());

            verify(storyQueryPort).listPublicStories("it");
        }

        @Test
        @DisplayName("Should default to 'en' when no lang parameter")
        void listStories_defaultLang() throws Exception {
            when(storyQueryPort.listPublicStories("en")).thenReturn(List.of());

            mockMvc.perform(get("/api/stories"))
                    .andExpect(status().isOk());

            verify(storyQueryPort).listPublicStories("en");
        }
    }

    // === GET /api/stories/{uuid} ===

    @Nested
    @DisplayName("GET /api/stories/{uuid}")
    class GetStory {

        @Test
        @DisplayName("Should return 200 with full story detail")
        void getStory_success() throws Exception {
            DifficultyInfo diff = DifficultyInfo.builder()
                    .uuid("diff-1").description("Easy").expCost(5).maxWeight(10)
                    .minCharacter(1).maxCharacter(4).costHelpComa(3)
                    .costMaxCharacteristics(3).numberMaxFreeAction(1)
                    .build();

            StoryDetail detail = StoryDetail.builder()
                    .uuid("uuid-1").title("Title").description("Desc")
                    .author("Author").category("adventure").group("fantasy")
                    .visibility("PUBLIC").priority(5).peghi(2)
                    .versionMin("0.10").versionMax("1.0")
                    .clockSingularDescription("hour").clockPluralDescription("hours")
                    .copyrightText("(c) 2025").linkCopyright("https://example.com")
                    .locationCount(10).eventCount(20).itemCount(5)
                    .difficulties(List.of(diff))
                    .build();

            when(storyQueryPort.getStoryByUuid("uuid-1", "en")).thenReturn(detail);

            mockMvc.perform(get("/api/stories/uuid-1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.uuid").value("uuid-1"))
                    .andExpect(jsonPath("$.title").value("Title"))
                    .andExpect(jsonPath("$.author").value("Author"))
                    .andExpect(jsonPath("$.versionMin").value("0.10"))
                    .andExpect(jsonPath("$.locationCount").value(10))
                    .andExpect(jsonPath("$.eventCount").value(20))
                    .andExpect(jsonPath("$.itemCount").value(5))
                    .andExpect(jsonPath("$.difficulties", hasSize(1)))
                    .andExpect(jsonPath("$.difficulties[0].uuid").value("diff-1"))
                    .andExpect(jsonPath("$.difficulties[0].description").value("Easy"))
                    .andExpect(jsonPath("$.difficulties[0].expCost").value(5));
        }

        @Test
        @DisplayName("Should return 404 when story not found")
        void getStory_notFound() throws Exception {
            when(storyQueryPort.getStoryByUuid("unknown", "en")).thenReturn(null);

            mockMvc.perform(get("/api/stories/unknown"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("STORY_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("No story found with UUID: unknown"));
        }

        @Test
        @DisplayName("Should pass lang parameter to port")
        void getStory_withLang() throws Exception {
            when(storyQueryPort.getStoryByUuid("uuid-1", "it")).thenReturn(null);

            mockMvc.perform(get("/api/stories/uuid-1").param("lang", "it"))
                    .andExpect(status().isNotFound());

            verify(storyQueryPort).getStoryByUuid("uuid-1", "it");
        }

        @Test
        @DisplayName("Should return JSON content type")
        void getStory_jsonContentType() throws Exception {
            StoryDetail detail = StoryDetail.builder()
                    .uuid("uuid-1").title("T").build();

            when(storyQueryPort.getStoryByUuid("uuid-1", "en")).thenReturn(detail);

            mockMvc.perform(get("/api/stories/uuid-1"))
                    .andExpect(status().isOk())
                    .andExpect(content().contentTypeCompatibleWith("application/json"));
        }

        @Test
        @DisplayName("Should handle story with empty difficulties list")
        void getStory_emptyDifficulties() throws Exception {
            StoryDetail detail = StoryDetail.builder()
                    .uuid("uuid-1").title("T").difficulties(List.of()).build();

            when(storyQueryPort.getStoryByUuid("uuid-1", "en")).thenReturn(detail);

            mockMvc.perform(get("/api/stories/uuid-1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.difficulties", hasSize(0)));
        }
    }
}
