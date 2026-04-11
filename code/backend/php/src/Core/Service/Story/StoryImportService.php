<?php

declare(strict_types=1);

namespace Games\Paths\Core\Service\Story;

use Games\Paths\Core\Domain\Story\StoryImportResult;
use Games\Paths\Core\Port\Story\StoryImportPort;
use Games\Paths\Core\Port\Story\StoryPersistencePort;
use Ramsey\Uuid\Uuid;

class StoryImportService implements StoryImportPort
{
    private StoryPersistencePort $persistencePort;

    public function __construct(StoryPersistencePort $persistencePort)
    {
        $this->persistencePort = $persistencePort;
    }

    public function importStory(array $data): StoryImportResult
    {
        if (empty($data)) {
            throw new \InvalidArgumentException("Empty import data");
        }

        $storyUuid = $data['uuid'] ?? '';
        if (trim($storyUuid) === '') {
            $storyUuid = Uuid::uuid4()->toString();
            $data['uuid'] = $storyUuid;
        }

        // Replace on conflict
        $this->deleteStory($storyUuid);

        // Save Header
        $storyId = $this->persistencePort->saveStory($data);

        // Texts
        $texts = $data['texts'] ?? [];
        if (!empty($texts)) {
            $this->persistencePort->saveTexts($storyId, $texts);
        }

        // Difficulties
        $diffs = $data['difficulties'] ?? [];
        if (!empty($diffs)) {
            foreach ($diffs as &$d) {
                if (empty($d['uuid'])) {
                    $d['uuid'] = Uuid::uuid4()->toString();
                }
            }
            unset($d);
            $this->persistencePort->saveDifficulties($storyId, $diffs);
        }

        // Other attributes
        if (!empty($data['locations'])) { $this->persistencePort->saveLocations($storyId, $data['locations']); }
        if (!empty($data['events'])) { $this->persistencePort->saveEvents($storyId, $data['events']); }
        if (!empty($data['items'])) { $this->persistencePort->saveItems($storyId, $data['items']); }
        if (!empty($data['classes'])) { $this->persistencePort->saveClasses($storyId, $data['classes']); }
        if (!empty($data['choices'])) { $this->persistencePort->saveChoices($storyId, $data['choices']); }
        if (!empty($data['cards'])) { $this->persistencePort->saveCards($storyId, $data['cards']); }
        if (!empty($data['keys'])) { $this->persistencePort->saveKeys($storyId, $data['keys']); }
        if (!empty($data['traits'])) { $this->persistencePort->saveTraits($storyId, $data['traits']); }
        if (!empty($data['characterTemplates'])) { $this->persistencePort->saveCharacterTemplates($storyId, $data['characterTemplates']); }
        if (!empty($data['weatherRules'])) { $this->persistencePort->saveWeatherRules($storyId, $data['weatherRules']); }
        if (!empty($data['globalRandomEvents'])) { $this->persistencePort->saveGlobalRandomEvents($storyId, $data['globalRandomEvents']); }
        if (!empty($data['missions'])) { $this->persistencePort->saveMissions($storyId, $data['missions']); }
        if (!empty($data['creators'])) { $this->persistencePort->saveCreators($storyId, $data['creators']); }

        return new StoryImportResult(
            $storyUuid,
            "IMPORTED",
            count($texts),
            count($data['locations'] ?? []),
            count($data['events'] ?? []),
            count($data['items'] ?? []),
            count($diffs),
            count($data['classes'] ?? []),
            count($data['choices'] ?? [])
        );
    }

    public function deleteStory(string $uuid): bool
    {
        if (trim($uuid) === '') {
            return false;
        }

        $storyId = $this->persistencePort->findStoryIdByUuid($uuid);
        if ($storyId === null) {
            return false;
        }

        $this->persistencePort->deleteStoryById($storyId);
        return true;
    }
}
