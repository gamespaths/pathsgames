<?php

namespace Games\Paths\Core\Domain\Matches;

class MatchCreateCommand
{
    private string $userUuid;
    private string $storyUuid;
    private string $difficultyUuid;
    private ?string $name;
    private ?string $characterTemplateUuid;

    public function __construct(
        string $userUuid,
        string $storyUuid,
        string $difficultyUuid,
        ?string $name = null,
        ?string $characterTemplateUuid = null
    ) {
        $this->userUuid = $userUuid;
        $this->storyUuid = $storyUuid;
        $this->difficultyUuid = $difficultyUuid;
        $this->name = $name;
        $this->characterTemplateUuid = $characterTemplateUuid;
    }

    public function getUserUuid(): string { return $this->userUuid; }
    public function getStoryUuid(): string { return $this->storyUuid; }
    public function getDifficultyUuid(): string { return $this->difficultyUuid; }
    public function getName(): ?string { return $this->name; }
    public function getCharacterTemplateUuid(): ?string { return $this->characterTemplateUuid; }
}
