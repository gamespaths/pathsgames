package games.paths.adapters.admin.controller.story;

import games.paths.adapters.admin.AdminConstant;
import games.paths.adapters.admin.dto.story.StoryImportResponse;
import games.paths.adapters.admin.dto.story.StorySummaryResponse;
import games.paths.core.model.story.StoryImportResult;
import games.paths.core.model.story.StorySummary;
import games.paths.core.port.story.StoryImportPort;
import games.paths.core.port.story.StoryQueryPort;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * StoryAdminController - REST adapter for story administration.
 *
 * <p>POST /api/admin/stories/import → import a complete story from JSON</p>
 * <p>GET  /api/admin/stories        → list all stories (any visibility)</p>
 * <p>GET  /api/admin/stories/{uuid} → get a single story detail (admin view)</p>
 * <p>DELETE /api/admin/stories/{uuid} → delete a story and all its data</p>
 *
 * <p>All endpoints require ADMIN role (enforced by JwtAuthenticationFilter).</p>
 */
@RestController
@RequestMapping("/api/admin/stories")
public class StoryAdminController {

    private final StoryImportPort storyImportPort;
    private final StoryQueryPort storyQueryPort;

    public StoryAdminController(StoryImportPort storyImportPort, StoryQueryPort storyQueryPort) {
        this.storyImportPort = storyImportPort;
        this.storyQueryPort = storyQueryPort;
    }

    /**
     * POST /api/admin/stories/import
     * Imports a complete story from a JSON body.
     * If the story UUID already exists, it will be replaced entirely.
     */
    @PostMapping("/import")
    public ResponseEntity<Object> importStory(@RequestBody Map<String, Object> storyData) {
        if (storyData == null || storyData.isEmpty()) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put(AdminConstant.KEY_ERROR, AdminConstant.EMPTY_IMPORT_DATA);
            error.put(AdminConstant.KEY_MESSAGE, AdminConstant.EMPTY_IMPORT_DATA_MESSAGE);
            return ResponseEntity.badRequest().body(error);
        }

        try {
            StoryImportResult result = storyImportPort.importStory(storyData);
            StoryImportResponse response = new StoryImportResponse(
                    result.getStoryUuid(),
                    result.getStatus(),
                    result.getTextsImported(),
                    result.getLocationsImported(),
                    result.getEventsImported(),
                    result.getItemsImported(),
                    result.getDifficultiesImported(),
                    result.getClassesImported(),
                    result.getChoicesImported());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put(AdminConstant.KEY_ERROR, AdminConstant.INVALID_IMPORT_DATA);
            error.put(AdminConstant.KEY_MESSAGE, e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * GET /api/admin/stories
     * Lists all stories (any visibility), ordered by ID.
     */
    @GetMapping
    public ResponseEntity<List<StorySummaryResponse>> listAllStories(
            @RequestParam(value = "lang", defaultValue = "en") String lang) {

        List<StorySummary> stories = storyQueryPort.listAllStories(lang);
        List<StorySummaryResponse> response = stories.stream()
                .map(s -> new StorySummaryResponse(
                        s.getUuid(), s.getTitle(), s.getDescription(), s.getAuthor(),
                        s.getCategory(), s.getGroup(), s.getVisibility(),
                        s.getPriority(), s.getPeghi(), s.getDifficultyCount()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    /**
     * DELETE /api/admin/stories/{uuid}
     * Deletes a story and all its related data by UUID.
     */
    @DeleteMapping("/{uuid}")
    public ResponseEntity<Map<String, String>> deleteStory(@PathVariable String uuid) {
        boolean deleted = storyImportPort.deleteStory(uuid);
        if (!deleted) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put(AdminConstant.KEY_ERROR, AdminConstant.STORY_NOT_FOUND);
            error.put(AdminConstant.KEY_MESSAGE, AdminConstant.STORY_NOT_FOUND_WITH_UUID + uuid);
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(error);
        }
        Map<String, String> result = new LinkedHashMap<>();
        result.put(AdminConstant.KEY_STATUS, "DELETED");
        result.put(AdminConstant.KEY_UUID, uuid);
        return ResponseEntity.ok(result);
    }
}
