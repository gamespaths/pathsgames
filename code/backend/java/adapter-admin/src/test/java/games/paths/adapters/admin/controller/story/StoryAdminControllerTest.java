package games.paths.adapters.admin.controller.story;

import games.paths.core.model.story.StoryImportResult;
import games.paths.core.model.story.StorySummary;
import games.paths.core.port.story.StoryImportPort;
import games.paths.core.port.story.StoryQueryPort;
import games.paths.core.port.story.StoryCrudPort;
import games.paths.core.port.story.StoryValidatorPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.List;
import java.util.Map;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Unit tests for {@link StoryAdminController}.
 * Uses MockMvc with standaloneSetup (no Spring context).
 */
class StoryAdminControllerTest {

    private MockMvc mockMvc;
    private StoryImportPort storyImportPort;
    private StoryQueryPort storyQueryPort;
    private StoryCrudPort storyCrudPort;
    private StoryValidatorPort storyValidatorPort;

    @BeforeEach
    void setup() {
        storyImportPort = mock(StoryImportPort.class);
        storyQueryPort = mock(StoryQueryPort.class);
        storyCrudPort = mock(StoryCrudPort.class);
        storyValidatorPort = mock(StoryValidatorPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                new StoryAdminController(storyImportPort, storyQueryPort, storyCrudPort, storyValidatorPort)).build();
    }

    // === POST /api/admin/stories/import ===

    @Nested
    @DisplayName("POST /api/admin/stories/import")
    class ImportStory {

        @Test
        @DisplayName("Should return 201 with import result on success")
        void importStory_success() throws Exception {
            StoryImportResult result = new StoryImportResult("uuid-1", "IMPORTED",
                    10, 5, 3, 7, 2, 4, 6);

            when(storyImportPort.importStory(any())).thenReturn(result);

            mockMvc.perform(post("/api/admin/stories/import")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"uuid\":\"uuid-1\",\"author\":\"Author\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.storyUuid").value("uuid-1"))
                    .andExpect(jsonPath("$.status").value("IMPORTED"))
                    .andExpect(jsonPath("$.textsImported").value(10))
                    .andExpect(jsonPath("$.locationsImported").value(5))
                    .andExpect(jsonPath("$.eventsImported").value(3))
                    .andExpect(jsonPath("$.itemsImported").value(7))
                    .andExpect(jsonPath("$.difficultiesImported").value(2))
                    .andExpect(jsonPath("$.classesImported").value(4))
                    .andExpect(jsonPath("$.choicesImported").value(6));
        }

        @Test
        @DisplayName("Should return 400 for empty JSON object")
        void importStory_emptyBody() throws Exception {
            mockMvc.perform(post("/api/admin/stories/import")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("EMPTY_IMPORT_DATA"));
        }

        @Test
        @DisplayName("Should return 400 when import throws IllegalArgumentException")
        void importStory_invalidData() throws Exception {
            when(storyImportPort.importStory(any()))
                    .thenThrow(new IllegalArgumentException("Invalid story data"));

            mockMvc.perform(post("/api/admin/stories/import")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"uuid\":\"uuid-1\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("INVALID_IMPORT_DATA"))
                    .andExpect(jsonPath("$.message").value("Invalid story data"));
        }
    }

    // === GET /api/admin/stories ===

    @Nested
    @DisplayName("GET /api/admin/stories")
    class ListAllStories {

        @Test
        @DisplayName("Should return 200 with all stories")
        void listAll_success() throws Exception {
            StorySummary s1 = new StorySummary("uuid-1", "Story 1", null, "Author1",
                    null, null, "PUBLIC", 0, 0, 2, null);
            StorySummary s2 = new StorySummary("uuid-2", "Story 2", null, "Author2",
                    null, null, "PRIVATE", 0, 0, 1, null);

            when(storyQueryPort.listAllStories("en")).thenReturn(List.of(s1, s2));

            mockMvc.perform(get("/api/admin/stories"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[0].uuid").value("uuid-1"))
                    .andExpect(jsonPath("$[0].visibility").value("PUBLIC"))
                    .andExpect(jsonPath("$[1].uuid").value("uuid-2"))
                    .andExpect(jsonPath("$[1].visibility").value("PRIVATE"));
        }

        @Test
        @DisplayName("Should return 200 with empty list when no stories")
        void listAll_empty() throws Exception {
            when(storyQueryPort.listAllStories("en")).thenReturn(List.of());

            mockMvc.perform(get("/api/admin/stories"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }

        @Test
        @DisplayName("Should pass lang parameter to port")
        void listAll_withLang() throws Exception {
            when(storyQueryPort.listAllStories("it")).thenReturn(List.of());

            mockMvc.perform(get("/api/admin/stories").param("lang", "it"))
                    .andExpect(status().isOk());

            verify(storyQueryPort).listAllStories("it");
        }
    }

    // === GET /api/admin/stories/{uuid} ===

    @Nested
    @DisplayName("GET /api/admin/stories/{uuid}")
    class GetStory {

        @Test
        @DisplayName("Should return 200 with full story detail")
        void getStory_success() throws Exception {
            Map<String, Object> storyDetail = Map.of("uuid", "uuid-1", "title", "Test Story");
            when(storyCrudPort.getStory("uuid-1")).thenReturn(storyDetail);

            mockMvc.perform(get("/api/admin/stories/uuid-1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.uuid").value("uuid-1"))
                    .andExpect(jsonPath("$.title").value("Test Story"));
        }

        @Test
        @DisplayName("Should return 404 when story not found")
        void getStory_notFound() throws Exception {
            when(storyCrudPort.getStory("unknown")).thenReturn(null);

            mockMvc.perform(get("/api/admin/stories/unknown"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("STORY_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("No story found with UUID: unknown"));
        }
    }

    // === DELETE /api/admin/stories/{uuid} ===

    @Nested
    @DisplayName("DELETE /api/admin/stories/{uuid}")
    class DeleteStory {

        @Test
        @DisplayName("Should return 200 when story deleted successfully")
        void deleteStory_success() throws Exception {
            when(storyImportPort.deleteStory("uuid-1")).thenReturn(true);

            mockMvc.perform(delete("/api/admin/stories/uuid-1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("DELETED"))
                    .andExpect(jsonPath("$.uuid").value("uuid-1"));
        }

        @Test
        @DisplayName("Should return 404 when story not found")
        void deleteStory_notFound() throws Exception {
            when(storyImportPort.deleteStory("nonexistent")).thenReturn(false);

            mockMvc.perform(delete("/api/admin/stories/nonexistent"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("STORY_NOT_FOUND"))
                    .andExpect(jsonPath("$.message").value("No story found with UUID: nonexistent"));
        }
    }

    // === Step 22: validation ===

    @Nested
    @DisplayName("Story validation (Step 22)")
    class Validation {

        @Test
        @DisplayName("import returns 400 INVALID_STORY with errors[] when validation fails")
        void importValidationFails() throws Exception {
            games.paths.core.model.story.StoryValidationReport report =
                    new games.paths.core.model.story.StoryValidationReport();
            report.add("R_EVENT_REF", "choices", "1", "idEvent", "choices idEvent=99 references a non-existent event");
            when(storyImportPort.importStory(anyMap()))
                    .thenThrow(new StoryValidatorPort.StoryValidationException(report));

            mockMvc.perform(post("/api/admin/stories/import")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"uuid\":\"x\",\"choices\":[{\"id\":1,\"idEvent\":99}]}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("INVALID_STORY"))
                    .andExpect(jsonPath("$.errors[0].field").value("idEvent"));
        }

        @Test
        @DisplayName("GET /{uuid}/validate returns 200 report for a valid story")
        void validateOk() throws Exception {
            when(storyCrudPort.getStory("uuid-1")).thenReturn(Map.of("id", 5));
            when(storyValidatorPort.validateStory(5L))
                    .thenReturn(new games.paths.core.model.story.StoryValidationReport());

            mockMvc.perform(get("/api/admin/stories/uuid-1/validate"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.valid").value(true))
                    .andExpect(jsonPath("$.count").value(0));
        }

        @Test
        @DisplayName("GET /{uuid}/validate returns 404 when story missing")
        void validateNotFound() throws Exception {
            when(storyCrudPort.getStory("ghost")).thenReturn(null);

            mockMvc.perform(get("/api/admin/stories/ghost/validate"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("STORY_NOT_FOUND"));
        }
    }
}
