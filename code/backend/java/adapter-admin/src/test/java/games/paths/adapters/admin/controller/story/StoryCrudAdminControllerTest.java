package games.paths.adapters.admin.controller.story;

import games.paths.core.port.story.StoryCrudPort;
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
 * Unit tests for {@link StoryCrudAdminController}.
 * Step 17: Uses MockMvc with standaloneSetup (no Spring context).
 */
class StoryCrudAdminControllerTest {

    private MockMvc mockMvc;
    private StoryCrudPort storyCrudPort;

    @BeforeEach
    void setup() {
        storyCrudPort = mock(StoryCrudPort.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                new StoryCrudAdminController(storyCrudPort)).build();
    }

    // === POST /api/admin/stories ===

    @Nested
    @DisplayName("POST /api/admin/stories")
    class CreateStory {

        @Test
        @DisplayName("Should return 201 on success")
        void createStory_success() throws Exception {
            Map<String, Object> result = Map.of("uuid", "new-uuid", "author", "Author");
            when(storyCrudPort.createStory(any())).thenReturn(result);

            mockMvc.perform(post("/api/admin/stories")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"author\":\"Author\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.uuid").value("new-uuid"));
        }

        @Test
        @DisplayName("Should return 400 for empty body")
        void createStory_emptyBody() throws Exception {
            mockMvc.perform(post("/api/admin/stories")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("EMPTY_IMPORT_DATA"));
        }

        @Test
        @DisplayName("Should return 400 when port returns null")
        void createStory_portReturnsNull() throws Exception {
            when(storyCrudPort.createStory(any())).thenReturn(null);

            mockMvc.perform(post("/api/admin/stories")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"author\":\"Author\"}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("INVALID_IMPORT_DATA"));
        }
    }

    // === PUT /api/admin/stories/{uuidStory} ===

    @Nested
    @DisplayName("PUT /api/admin/stories/{uuidStory}")
    class UpdateStory {

        @Test
        @DisplayName("Should return 200 on success")
        void updateStory_success() throws Exception {
            Map<String, Object> result = Map.of("uuid", "uuid-1", "author", "Updated");
            when(storyCrudPort.updateStory(eq("uuid-1"), any())).thenReturn(result);

            mockMvc.perform(put("/api/admin/stories/uuid-1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"author\":\"Updated\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.author").value("Updated"));
        }

        @Test
        @DisplayName("Should return 404 when story not found")
        void updateStory_notFound() throws Exception {
            when(storyCrudPort.updateStory(eq("missing"), any())).thenReturn(null);

            mockMvc.perform(put("/api/admin/stories/missing")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"author\":\"Updated\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("STORY_NOT_FOUND"));
        }

        @Test
        @DisplayName("Should return 400 for empty body")
        void updateStory_emptyBody() throws Exception {
            mockMvc.perform(put("/api/admin/stories/uuid-1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("EMPTY_IMPORT_DATA"));
        }
    }

    // === GET /api/admin/stories/{uuidStory}/{entityType} ===

    @Nested
    @DisplayName("GET /api/admin/stories/{uuidStory}/{entityType}")
    class ListEntities {

        @Test
        @DisplayName("Should return 200 with entity list")
        void listEntities_success() throws Exception {
            List<Map<String, Object>> result = List.of(
                    Map.of("uuid", "e1"), Map.of("uuid", "e2"));
            when(storyCrudPort.listEntities("uuid-1", "locations")).thenReturn(result);

            mockMvc.perform(get("/api/admin/stories/uuid-1/locations"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(2)))
                    .andExpect(jsonPath("$[0].uuid").value("e1"));
        }

        @Test
        @DisplayName("Should return 404 when story not found")
        void listEntities_storyNotFound() throws Exception {
            when(storyCrudPort.listEntities("missing", "locations")).thenReturn(null);

            mockMvc.perform(get("/api/admin/stories/missing/locations"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("STORY_NOT_FOUND"));
        }
    }

    // === GET /api/admin/stories/{uuidStory}/{entityType}/{entityUuid} ===

    @Nested
    @DisplayName("GET /api/admin/stories/{uuidStory}/{entityType}/{entityUuid}")
    class GetEntity {

        @Test
        @DisplayName("Should return 200 with entity")
        void getEntity_success() throws Exception {
            Map<String, Object> result = Map.of("uuid", "e1", "name", "Castle");
            when(storyCrudPort.getEntity("uuid-1", "locations", "e1")).thenReturn(result);

            mockMvc.perform(get("/api/admin/stories/uuid-1/locations/e1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Castle"));
        }

        @Test
        @DisplayName("Should return 404 when not found")
        void getEntity_notFound() throws Exception {
            when(storyCrudPort.getEntity("uuid-1", "locations", "missing")).thenReturn(null);

            mockMvc.perform(get("/api/admin/stories/uuid-1/locations/missing"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("ENTITY_NOT_FOUND"));
        }
    }

    // === POST /api/admin/stories/{uuidStory}/{entityType} ===

    @Nested
    @DisplayName("POST /api/admin/stories/{uuidStory}/{entityType}")
    class CreateEntity {

        @Test
        @DisplayName("Should return 201 on success")
        void createEntity_success() throws Exception {
            Map<String, Object> result = Map.of("uuid", "new-e1");
            when(storyCrudPort.createEntity(eq("uuid-1"), eq("locations"), any())).thenReturn(result);

            mockMvc.perform(post("/api/admin/stories/uuid-1/locations")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Castle\"}"))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.uuid").value("new-e1"));
        }

        @Test
        @DisplayName("Should return 404 when story not found")
        void createEntity_storyNotFound() throws Exception {
            when(storyCrudPort.createEntity(eq("missing"), eq("locations"), any())).thenReturn(null);

            mockMvc.perform(post("/api/admin/stories/missing/locations")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Castle\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("STORY_NOT_FOUND"));
        }

        @Test
        @DisplayName("Should return 400 for empty body")
        void createEntity_emptyBody() throws Exception {
            mockMvc.perform(post("/api/admin/stories/uuid-1/locations")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("EMPTY_IMPORT_DATA"));
        }
    }

    // === PUT /api/admin/stories/{uuidStory}/{entityType}/{entityUuid} ===

    @Nested
    @DisplayName("PUT /api/admin/stories/{uuidStory}/{entityType}/{entityUuid}")
    class UpdateEntity {

        @Test
        @DisplayName("Should return 200 on success")
        void updateEntity_success() throws Exception {
            Map<String, Object> result = Map.of("uuid", "e1", "name", "Updated");
            when(storyCrudPort.updateEntity(eq("uuid-1"), eq("locations"), eq("e1"), any())).thenReturn(result);

            mockMvc.perform(put("/api/admin/stories/uuid-1/locations/e1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Updated\"}"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Updated"));
        }

        @Test
        @DisplayName("Should return 404 when not found")
        void updateEntity_notFound() throws Exception {
            when(storyCrudPort.updateEntity(eq("uuid-1"), eq("locations"), eq("missing"), any())).thenReturn(null);

            mockMvc.perform(put("/api/admin/stories/uuid-1/locations/missing")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"name\":\"Updated\"}"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("ENTITY_NOT_FOUND"));
        }

        @Test
        @DisplayName("Should return 400 for empty body")
        void updateEntity_emptyBody() throws Exception {
            mockMvc.perform(put("/api/admin/stories/uuid-1/locations/e1")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{}"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("EMPTY_IMPORT_DATA"));
        }
    }

    // === DELETE /api/admin/stories/{uuidStory}/{entityType}/{entityUuid} ===

    @Nested
    @DisplayName("DELETE /api/admin/stories/{uuidStory}/{entityType}/{entityUuid}")
    class DeleteEntity {

        @Test
        @DisplayName("Should return 200 on success")
        void deleteEntity_success() throws Exception {
            when(storyCrudPort.deleteEntity("uuid-1", "locations", "e1")).thenReturn(true);

            mockMvc.perform(delete("/api/admin/stories/uuid-1/locations/e1"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.status").value("DELETED"))
                    .andExpect(jsonPath("$.uuid").value("e1"));
        }

        @Test
        @DisplayName("Should return 404 when not found")
        void deleteEntity_notFound() throws Exception {
            when(storyCrudPort.deleteEntity("uuid-1", "locations", "missing")).thenReturn(false);

            mockMvc.perform(delete("/api/admin/stories/uuid-1/locations/missing"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.error").value("ENTITY_NOT_FOUND"));
        }
    }
}
