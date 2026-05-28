package games.paths.adapters.admin.controller.story;

import games.paths.adapters.admin.AdminConstant;
import games.paths.core.port.story.StoryCrudPort;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * StoryCrudAdminController - Admin REST controller for story entity CRUD.
 * Step 17: Provides create, read, update, delete endpoints for all story sub-entities.
 * All endpoints require ADMIN role (enforced by JwtAuthenticationFilter on /api/admin/**).
 */
@RestController
@RequestMapping("/api/admin/stories")
public class StoryCrudAdminController {

    private final StoryCrudPort storyCrudPort;

    public StoryCrudAdminController(StoryCrudPort storyCrudPort) {
        this.storyCrudPort = storyCrudPort;
    }

    // === Story-level CRUD ===

    @PostMapping
    public ResponseEntity<Map<String, Object>> createStory(@RequestBody Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", AdminConstant.EMPTY_IMPORT_DATA,
                    "message", "Request body must not be empty"));
        }
        Map<String, Object> result = storyCrudPort.createStory(data);
        if (result == null) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", AdminConstant.INVALID_IMPORT_DATA,
                    "message", "Failed to create story"));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PutMapping("/{uuidStory}")
    public ResponseEntity<Map<String, Object>> updateStory(
            @PathVariable String uuidStory,
            @RequestBody Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", AdminConstant.EMPTY_IMPORT_DATA,
                    "message", "Request body must not be empty"));
        }
        Map<String, Object> result = storyCrudPort.updateStory(uuidStory, data);
        if (result == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", AdminConstant.STORY_NOT_FOUND,
                    "message", "No story found with UUID: " + uuidStory));
        }
        return ResponseEntity.ok(result);
    }

    // === Sub-entity CRUD: List ===

    @GetMapping("/{uuidStory}/{entityType}")
    public ResponseEntity<?> listEntities(
            @PathVariable String uuidStory,
            @PathVariable String entityType) {
        List<Map<String, Object>> result = storyCrudPort.listEntities(uuidStory, entityType);
        if (result == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", AdminConstant.STORY_NOT_FOUND,
                    "message", "No story found with UUID: " + uuidStory));
        }
        return ResponseEntity.ok(result);
    }

    // === Sub-entity CRUD: Get single ===

    @GetMapping("/{uuidStory}/{entityType}/{entityUuid}")
    public ResponseEntity<?> getEntity(
            @PathVariable String uuidStory,
            @PathVariable String entityType,
            @PathVariable String entityUuid) {
        Map<String, Object> result = storyCrudPort.getEntity(uuidStory, entityType, entityUuid);
        if (result == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "ENTITY_NOT_FOUND",
                    "message", "No " + entityType + " found with UUID: " + entityUuid));
        }
        return ResponseEntity.ok(result);
    }

    // === Sub-entity CRUD: Create ===

    @PostMapping("/{uuidStory}/{entityType}")
    public ResponseEntity<?> createEntity(
            @PathVariable String uuidStory,
            @PathVariable String entityType,
            @RequestBody Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", AdminConstant.EMPTY_IMPORT_DATA,
                    "message", "Request body must not be empty"));
        }
        Map<String, Object> result = storyCrudPort.createEntity(uuidStory, entityType, data);
        if (result == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", AdminConstant.STORY_NOT_FOUND,
                    "message", "No story found with UUID: " + uuidStory));
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    // === Sub-entity CRUD: Update ===

    @PutMapping("/{uuidStory}/{entityType}/{entityUuid}")
    public ResponseEntity<?> updateEntity(
            @PathVariable String uuidStory,
            @PathVariable String entityType,
            @PathVariable String entityUuid,
            @RequestBody Map<String, Object> data) {
        if (data == null || data.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", AdminConstant.EMPTY_IMPORT_DATA,
                    "message", "Request body must not be empty"));
        }
        Map<String, Object> result = storyCrudPort.updateEntity(uuidStory, entityType, entityUuid, data);
        if (result == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "error", "ENTITY_NOT_FOUND",
                    "message", "No " + entityType + " found with UUID: " + entityUuid));
        }
        return ResponseEntity.ok(result);
    }

    // === Sub-entity CRUD: Delete ===

    @DeleteMapping("/{uuidStory}/{entityType}/{entityUuid}")
    public ResponseEntity<?> deleteEntity(
            @PathVariable String uuidStory,
            @PathVariable String entityType,
            @PathVariable String entityUuid) {
        boolean deleted = storyCrudPort.deleteEntity(uuidStory, entityType, entityUuid);
        if (deleted) {
            return ResponseEntity.ok(Map.of(
                    "status", "DELETED",
                    "uuid", entityUuid,
                    "entityType", entityType));
        }
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "error", "ENTITY_NOT_FOUND",
                "message", "No " + entityType + " found with UUID: " + entityUuid));
    }
}
