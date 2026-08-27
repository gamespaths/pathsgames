package games.paths.adapters.rest.controller.story;

import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.CharacterTemplateInfo;
import games.paths.core.model.story.ClassInfo;
import games.paths.core.model.story.DifficultyInfo;
import games.paths.core.model.story.StoryDetail;
import games.paths.core.model.story.StorySummary;
import games.paths.core.model.story.TraitInfo;
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
 * Enhanced in Step 15 with tests for category/group endpoints
 * and enriched story detail response.
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
            StorySummary s1 = new StorySummary("uuid-1", "Story One", "Desc 1",
                    "Author1", "adventure", "fantasy", "PUBLIC", 5, 2, 3, null);
            StorySummary s2 = new StorySummary("uuid-2", "Story Two", "Desc 2",
                    "Author2", "horror", "dark", "PUBLIC", 3, 1, 1, null);

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
        @DisplayName("Should return 200 with full story detail including Step 15 fields")
        void getStory_success() throws Exception {
            DifficultyInfo diff = DifficultyInfo.builder()
                    .uuid("diff-1").description("Easy").expCost(5).maxWeight(10)
                    .minCharacter(1).maxCharacter(4).costHelpComa(3)
                    .costMaxCharacteristics(3).numberMaxFreeAction(1)
                    .build();

            CharacterTemplateInfo ct = new CharacterTemplateInfo("ct-1", "Warrior",
                    "Strong fighter", 20, 10, 5, 2, 1, 3, null, null, null, null);

            ClassInfo ci = new ClassInfo(null, "class-1", "Knight", "Noble warrior",
                    15, 2, 1, 3, null, null, List.of());

            TraitInfo ti = TraitInfo.builder()
                    .uuid("trait-1").name("Brave").description("Fearless")
                    .costPositive(2).costNegative(0)
                    .idClassPermitted(null).idClassProhibited(null)
                    .build();

            CardInfo card = new CardInfo("card-1", null, "https://example.com/card.png",
                    "alt", "fa-star", "bg-primary", "text-light", null, null, null,
                    "Card Title", null, null, null, null);

            StoryDetail detail = StoryDetail.builder()
                    .uuid("uuid-1").title("Title").description("Desc")
                    .author("Author").category("adventure").group("fantasy")
                    .visibility("PUBLIC").priority(5).peghi(2)
                    .versionMin("0.10").versionMax("1.0")
                    .clockSingularDescription("hour").clockPluralDescription("hours")
                    .idTextClockSingular(10).idTextClockPlural(11)
                    .copyrightText("(c) 2025").linkCopyright("https://example.com")
                    .locationCount(10).eventCount(20).itemCount(5)
                    .classCount(1).characterTemplateCount(1).traitCount(1)
                    .difficulties(List.of(diff))
                    .characterTemplates(List.of(ct))
                    .classes(List.of(ci))
                    .traits(List.of(ti))
                    .card(card)
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
                    .andExpect(jsonPath("$.classCount").value(1))
                    .andExpect(jsonPath("$.characterTemplateCount").value(1))
                    .andExpect(jsonPath("$.traitCount").value(1))
                    .andExpect(jsonPath("$.difficulties", hasSize(1)))
                    .andExpect(jsonPath("$.difficulties[0].uuid").value("diff-1"))
                    .andExpect(jsonPath("$.difficulties[0].description").value("Easy"))
                    .andExpect(jsonPath("$.difficulties[0].expCost").value(5))
                    // Character templates
                    .andExpect(jsonPath("$.characterTemplates", hasSize(1)))
                    .andExpect(jsonPath("$.characterTemplates[0].uuid").value("ct-1"))
                    .andExpect(jsonPath("$.characterTemplates[0].name").value("Warrior"))
                    .andExpect(jsonPath("$.characterTemplates[0].lifeMax").value(20))
                    // Classes
                    .andExpect(jsonPath("$.classes", hasSize(1)))
                    .andExpect(jsonPath("$.classes[0].uuid").value("class-1"))
                    .andExpect(jsonPath("$.classes[0].name").value("Knight"))
                    .andExpect(jsonPath("$.classes[0].weightMax").value(15))
                    // Traits
                    .andExpect(jsonPath("$.traits", hasSize(1)))
                    .andExpect(jsonPath("$.traits[0].uuid").value("trait-1"))
                    .andExpect(jsonPath("$.traits[0].name").value("Brave"))
                    .andExpect(jsonPath("$.traits[0].costPositive").value(2))
                    // Card
                    .andExpect(jsonPath("$.card.uuid").value("card-1"))
                    .andExpect(jsonPath("$.card.urlImage").value("https://example.com/card.png"))
                    .andExpect(jsonPath("$.card.title").value("Card Title"));
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
        @DisplayName("Should handle story with empty lists and null card")
        void getStory_emptyListsNullCard() throws Exception {
            StoryDetail detail = StoryDetail.builder()
                    .uuid("uuid-1").title("T")
                    .difficulties(List.of())
                    .characterTemplates(List.of())
                    .classes(List.of())
                    .traits(List.of())
                    .card(null)
                    .build();

            when(storyQueryPort.getStoryByUuid("uuid-1", "en")).thenReturn(detail);

            mockMvc.perform(get("/api/stories/uuid-1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.difficulties", hasSize(0)))
                    .andExpect(jsonPath("$.characterTemplates", hasSize(0)))
                    .andExpect(jsonPath("$.classes", hasSize(0)))
                    .andExpect(jsonPath("$.traits", hasSize(0)))
                    .andExpect(jsonPath("$.card").doesNotExist());
        }
    }

    // === GET /api/stories/categories (Step 15) ===

    @Nested
    @DisplayName("GET /api/stories/categories")
    class ListCategories {

        @Test
        @DisplayName("Should return 200 with list of categories")
        void listCategories_success() throws Exception {
            when(storyQueryPort.listCategories()).thenReturn(List.of("adventure", "horror", "sci-fi"));

            mockMvc.perform(get("/api/stories/categories"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(3)))
                    .andExpect(jsonPath("$[0]").value("adventure"))
                    .andExpect(jsonPath("$[1]").value("horror"))
                    .andExpect(jsonPath("$[2]").value("sci-fi"));
        }

        @Test
        @DisplayName("Should return 200 with empty list when no categories")
        void listCategories_empty() throws Exception {
            when(storyQueryPort.listCategories()).thenReturn(List.of());

            mockMvc.perform(get("/api/stories/categories"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }
    }

    // === GET /api/stories/category/{category} (Step 15) ===

    @Nested
    @DisplayName("GET /api/stories/category/{category}")
    class ListStoriesByCategory {

        @Test
        @DisplayName("Should return 200 with stories matching category")
        void listByCategory_success() throws Exception {
            StorySummary s = new StorySummary("uuid-1", "Title", "Desc", "Author", "adventure", "fantasy", "PUBLIC", 5, 2, 1, null);

            when(storyQueryPort.listStoriesByCategory("adventure", "en")).thenReturn(List.of(s));

            mockMvc.perform(get("/api/stories/category/adventure"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].uuid").value("uuid-1"))
                    .andExpect(jsonPath("$[0].category").value("adventure"));
        }

        @Test
        @DisplayName("Should return 200 with empty list for unknown category")
        void listByCategory_empty() throws Exception {
            when(storyQueryPort.listStoriesByCategory("unknown", "en")).thenReturn(List.of());

            mockMvc.perform(get("/api/stories/category/unknown"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("Should pass lang parameter to port")
        void listByCategory_withLang() throws Exception {
            when(storyQueryPort.listStoriesByCategory("adventure", "it")).thenReturn(List.of());

            mockMvc.perform(get("/api/stories/category/adventure").param("lang", "it"))
                    .andExpect(status().isOk());

            verify(storyQueryPort).listStoriesByCategory("adventure", "it");
        }

        @Test
        @DisplayName("Should default to 'en' when no lang parameter")
        void listByCategory_defaultLang() throws Exception {
            when(storyQueryPort.listStoriesByCategory("adventure", "en")).thenReturn(List.of());

            mockMvc.perform(get("/api/stories/category/adventure"))
                    .andExpect(status().isOk());

            verify(storyQueryPort).listStoriesByCategory("adventure", "en");
        }
    }

    // === GET /api/stories/groups (Step 15) ===

    @Nested
    @DisplayName("GET /api/stories/groups")
    class ListGroups {

        @Test
        @DisplayName("Should return 200 with list of groups")
        void listGroups_success() throws Exception {
            when(storyQueryPort.listGroups()).thenReturn(List.of("dark", "fantasy"));

            mockMvc.perform(get("/api/stories/groups"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[0]").value("dark"))
                    .andExpect(jsonPath("$[1]").value("fantasy"));
        }

        @Test
        @DisplayName("Should return 200 with empty list when no groups")
        void listGroups_empty() throws Exception {
            when(storyQueryPort.listGroups()).thenReturn(List.of());

            mockMvc.perform(get("/api/stories/groups"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }
    }

    // === GET /api/stories/group/{group} (Step 15) ===

    @Nested
    @DisplayName("GET /api/stories/group/{group}")
    class ListStoriesByGroup {

        @Test
        @DisplayName("Should return 200 with stories matching group")
        void listByGroup_success() throws Exception {
            StorySummary s = new StorySummary("uuid-1", "Title", "Desc", "Author", "adventure", "fantasy", "PUBLIC", 5, 2, 1, null);

            when(storyQueryPort.listStoriesByGroup("fantasy", "en")).thenReturn(List.of(s));

            mockMvc.perform(get("/api/stories/group/fantasy"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].uuid").value("uuid-1"))
                    .andExpect(jsonPath("$[0].group").value("fantasy"));
        }

        @Test
        @DisplayName("Should return 200 with empty list for unknown group")
        void listByGroup_empty() throws Exception {
            when(storyQueryPort.listStoriesByGroup("unknown", "en")).thenReturn(List.of());

            mockMvc.perform(get("/api/stories/group/unknown"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("Should pass lang parameter to port")
        void listByGroup_withLang() throws Exception {
            when(storyQueryPort.listStoriesByGroup("fantasy", "it")).thenReturn(List.of());

            mockMvc.perform(get("/api/stories/group/fantasy").param("lang", "it"))
                    .andExpect(status().isOk());

            verify(storyQueryPort).listStoriesByGroup("fantasy", "it");
        }

        @Test
        @DisplayName("Should default to 'en' when no lang parameter")
        void listByGroup_defaultLang() throws Exception {
            when(storyQueryPort.listStoriesByGroup("fantasy", "en")).thenReturn(List.of());

            mockMvc.perform(get("/api/stories/group/fantasy"))
                    .andExpect(status().isOk());

            verify(storyQueryPort).listStoriesByGroup("fantasy", "en");
        }
    }

    // === GET /api/stories/{uuidStory}/classes/{uuidClass}/traits (Step 23) ===

    @Nested
    @DisplayName("GET /api/stories/{uuidStory}/classes/{uuidClass}/traits")
    class TraitsForClass {

        private static final String URL = "/api/stories/story-1/classes/class-1/traits";

        @Test
        @DisplayName("Should return 200 with the traits selectable for the class")
        void traits_ok() throws Exception {
            CardInfo card = new CardInfo("card-1", null, "https://example.com/card.png",
                    "alt", "fa-star", "bg-primary", "text-light", null, null, null,
                    "Card Title", null, null, null, null);
            TraitInfo ti = TraitInfo.builder()
                    .uuid("trait-1").name("Brave").description("Fearless")
                    .costPositive(2).costNegative(0)
                    .idClassPermitted(7).idClassProhibited(null)
                    .idCard(1).card(card)
                    .life(1).energy(2).sad(3).dexterity(4).intelligence(5).constitution(6).weight(7)
                    .build();
            when(storyQueryPort.listTraitsForClass("story-1", "class-1", "en"))
                    .thenReturn(StoryQueryPort.TraitsForClassResult.ok(List.of(ti)));

            mockMvc.perform(get(URL))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].uuid", is("trait-1")))
                    .andExpect(jsonPath("$[0].name", is("Brave")))
                    .andExpect(jsonPath("$[0].card.title", is("Card Title")));
        }

        @Test
        @DisplayName("Should return 200 with an empty list when nothing is selectable")
        void traits_empty() throws Exception {
            when(storyQueryPort.listTraitsForClass("story-1", "class-1", "en"))
                    .thenReturn(StoryQueryPort.TraitsForClassResult.ok(List.of()));

            mockMvc.perform(get(URL))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("Should return 404 STORY_NOT_FOUND when the story is unknown")
        void traits_storyNotFound() throws Exception {
            when(storyQueryPort.listTraitsForClass("story-1", "class-1", "en"))
                    .thenReturn(StoryQueryPort.TraitsForClassResult.storyNotFound());

            mockMvc.perform(get(URL))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error", is("STORY_NOT_FOUND")))
                    .andExpect(jsonPath("$.message", containsString("story-1")));
        }

        @Test
        @DisplayName("Should return 404 CLASS_NOT_FOUND when the class is unknown")
        void traits_classNotFound() throws Exception {
            when(storyQueryPort.listTraitsForClass("story-1", "class-1", "en"))
                    .thenReturn(StoryQueryPort.TraitsForClassResult.classNotFound());

            mockMvc.perform(get(URL))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error", is("CLASS_NOT_FOUND")))
                    .andExpect(jsonPath("$.message", containsString("class-1")));
        }

        @Test
        @DisplayName("Should pass the requested language through")
        void traits_lang() throws Exception {
            when(storyQueryPort.listTraitsForClass("story-1", "class-1", "it"))
                    .thenReturn(StoryQueryPort.TraitsForClassResult.ok(List.of()));

            mockMvc.perform(get(URL).param("lang", "it"))
                    .andExpect(status().isOk());

            verify(storyQueryPort).listTraitsForClass("story-1", "class-1", "it");
        }
    }
}
