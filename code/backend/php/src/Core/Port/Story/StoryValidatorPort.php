<?php

declare(strict_types=1);

namespace Games\Paths\Core\Port\Story;

use Games\Paths\Core\Domain\Story\StoryValidationReport;

/**
 * StoryValidatorPort - inbound port for story integrity validation (Step 22).
 */
interface StoryValidatorPort
{
    /** Validates a raw import map (in-memory, no DB read). */
    public function validateImportData(array $storyData): StoryValidationReport;

    /** Validates a persisted story by its numeric id, loading all entities. */
    public function validateStory(int $storyId): StoryValidationReport;

    /** Validates a single entity payload against entity-local rules only. */
    public function validateEntity(string $entityType, array $data): StoryValidationReport;
}
