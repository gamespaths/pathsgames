<?php

declare(strict_types=1);

namespace Games\Paths\Core\Port\Story;

/**
 * StoryCrudPort — Step 17: Inbound port for generic admin CRUD on story entities.
 */
interface StoryCrudPort
{
    /**
     * @return array[]|null  List of entities, or null if story not found.
     */
    public function listEntities(string $storyUuid, string $entityType): ?array;

    /**
     * @return array|null  Entity data, or null if not found.
     */
    public function getEntity(string $storyUuid, string $entityType, string $entityUuid): ?array;

    /**
     * @return array|null  Created entity, or null if invalid.
     */
    public function createEntity(string $storyUuid, string $entityType, array $data): ?array;

    /**
     * @return array|null  Updated entity, or null if not found.
     */
    public function updateEntity(string $storyUuid, string $entityType, string $entityUuid, array $data): ?array;

    /**
     * @return bool  True if deleted, false if not found.
     */
    public function deleteEntity(string $storyUuid, string $entityType, string $entityUuid): bool;

    /**
     * @return array|null  Created story.
     */
    public function createStory(array $data): ?array;

    /**
     * @return array|null  Updated story, or null if not found.
     */
    public function updateStory(string $storyUuid, array $data): ?array;
}
