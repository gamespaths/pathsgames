<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

class StoryImportResult
{
    public function __construct(
        public string $storyUuid,
        public string $status,
        public int $textsImported = 0,
        public int $locationsImported = 0,
        public int $eventsImported = 0,
        public int $itemsImported = 0,
        public int $difficultiesImported = 0,
        public int $classesImported = 0,
        public int $choicesImported = 0
    ) {
    }
}
