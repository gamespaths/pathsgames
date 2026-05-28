<?php

declare(strict_types=1);

namespace Games\Paths\Core\Port\Story;

use Games\Paths\Core\Domain\Story\StoryImportResult;

interface StoryImportPort
{
    public function importStory(array $data): StoryImportResult;

    public function deleteStory(string $uuid): bool;
}
