package games.paths.core.port.story;

import java.util.List;
import java.util.Map;

/**
 * StoryCrudPort - Inbound port for admin CRUD operations on story entities.
 * Part of the Hexagonal Architecture: this is a domain port
 * that the adapter-admin module will call for story entity CRUD.
 *
 * <p>Step 17: Provides generic CRUD operations for all story-related entities
 * (difficulties, locations, events, items, characters, etc.).</p>
 *
 * <p>All operations are scoped to a story UUID and require ADMIN role
 * (enforced by JwtAuthenticationFilter on /api/admin/** paths).</p>
 */
public interface StoryCrudPort {

    /**
     * Lists all entities of the given type for a story.
     *
     * @param storyUuid the story UUID
     * @param entityType the entity type (e.g., "difficulties", "locations", "events")
     * @return list of entity maps, or null if story not found
     */
    List<Map<String, Object>> listEntities(String storyUuid, String entityType);

    /**
     * Gets a single entity by its UUID within a story.
     *
     * @param storyUuid the story UUID
     * @param entityType the entity type
     * @param entityUuid the entity UUID
     * @return entity map, or null if not found
     */
    Map<String, Object> getEntity(String storyUuid, String entityType, String entityUuid);

    /**
     * Creates a new entity within a story.
     *
     * @param storyUuid the story UUID
     * @param entityType the entity type
     * @param data the entity data
     * @return created entity map with generated UUID, or null if story not found
     */
    Map<String, Object> createEntity(String storyUuid, String entityType, Map<String, Object> data);

    /**
     * Updates an existing entity within a story.
     *
     * @param storyUuid the story UUID
     * @param entityType the entity type
     * @param entityUuid the entity UUID
     * @param data the updated entity data
     * @return updated entity map, or null if not found
     */
    Map<String, Object> updateEntity(String storyUuid, String entityType, String entityUuid, Map<String, Object> data);

    /**
     * Deletes an entity within a story.
     *
     * @param storyUuid the story UUID
     * @param entityType the entity type
     * @param entityUuid the entity UUID
     * @return true if deleted, false if not found
     */
    boolean deleteEntity(String storyUuid, String entityType, String entityUuid);

    /**
     * Updates the story itself (metadata fields).
     *
     * @param storyUuid the story UUID
     * @param data the updated story data
     * @return updated story map, or null if not found
     */
    Map<String, Object> updateStory(String storyUuid, Map<String, Object> data);

    /**
     * Creates a new story from the given data.
     *
     * @param data the story data
     * @return created story map with generated UUID
     */
    Map<String, Object> createStory(Map<String, Object> data);
}
