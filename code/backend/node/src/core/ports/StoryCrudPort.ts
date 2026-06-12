/**
 * StoryCrudPort - Inbound port for admin CRUD operations on story entities.
 * Part of Hexagonal Architecture: domain port that adapter-admin will call for story entity CRUD.
 * 
 * Step 17: Provides generic CRUD operations for all story-related entities
 * (difficulties, locations, events, items, characters, etc.).
 * 
 * All operations are scoped to a story UUID and require ADMIN role
 * (enforced by JWT middleware on admin port 8044).
 */

export interface StoryCrudPort {
  /**
   * Lists all entities of the given type for a story.
   * 
   * @param storyUuid the story UUID
   * @param entityType the entity type (e.g., "difficulties", "locations", "events")
   * @return list of entity objects, or null if story not found
   */
  listEntities(storyUuid: string, entityType: string): Promise<any[] | null>;

  /**
   * Gets a single entity by UUID.
   * 
   * @param storyUuid the story UUID
   * @param entityType the entity type
   * @param entityUuid the entity UUID
   * @return entity object, or null if not found
   */
  getEntity(storyUuid: string, entityType: string, entityUuid: string): Promise<any | null>;

  /**
   * Creates a new entity of the given type.
   * 
   * @param storyUuid the story UUID
   * @param entityType the entity type
   * @param data the entity data
   * @return created entity with uuid, or null if story not found/invalid
   */
  createEntity(storyUuid: string, entityType: string, data: any): Promise<any | null>;

  /**
   * Updates an existing entity.
   * 
   * @param storyUuid the story UUID
   * @param entityType the entity type
   * @param entityUuid the entity UUID
   * @param data the updated entity data
   * @return updated entity, or null if not found
   */
  updateEntity(storyUuid: string, entityType: string, entityUuid: string, data: any): Promise<any | null>;

  /**
   * Deletes an entity by UUID.
   * 
   * @param storyUuid the story UUID
   * @param entityType the entity type
   * @param entityUuid the entity UUID
   * @return true if deleted, false if not found
   */
  deleteEntity(storyUuid: string, entityType: string, entityUuid: string): Promise<boolean>;

  /**
   * Updates a story's metadata fields.
   * 
   * @param storyUuid the story UUID
   * @param data the updated story data
   * @return updated story, or null if not found
   */
  updateStory(storyUuid: string, data: any): Promise<any | null>;

  /**
   * Creates a new story from admin console.
   * 
   * @param data the story data
   * @return created story with uuid, or null if invalid
   */
  createStory(data: any): Promise<any | null>;
}
