<?php

namespace Games\Paths\Core\Domain\Matches;

class MatchCreateCommand
{
    private string $userUuid;
    private string $storyUuid;
    private string $difficultyUuid;
    private ?string $name;
    private ?string $characterTemplateUuid;
    private ?string $classUuid;
    /** @var string[] */
    private array $traitUuids;
    private ?int $singlePlayer;

    /**
     * @param string[] $traitUuids Step 0.19.9 — selected trait uuids.
     */
    public function __construct(
        string $userUuid,
        string $storyUuid,
        string $difficultyUuid,
        ?string $name = null,
        ?string $characterTemplateUuid = null,
        ?string $classUuid = null,
        array $traitUuids = [],
        ?int $singlePlayer = null
    ) {
        $this->userUuid = $userUuid;
        $this->storyUuid = $storyUuid;
        $this->difficultyUuid = $difficultyUuid;
        $this->name = $name;
        $this->characterTemplateUuid = $characterTemplateUuid;
        $this->classUuid = $classUuid;
        $this->traitUuids = $traitUuids;
        $this->singlePlayer = $singlePlayer;
    }

    public function getUserUuid(): string { return $this->userUuid; }
    public function getStoryUuid(): string { return $this->storyUuid; }
    public function getDifficultyUuid(): string { return $this->difficultyUuid; }
    public function getName(): ?string { return $this->name; }
    public function getCharacterTemplateUuid(): ?string { return $this->characterTemplateUuid; }
    public function getClassUuid(): ?string { return $this->classUuid; }

    /** @return string[] */
    public function getTraitUuids(): array { return $this->traitUuids; }

    public function getSinglePlayer(): ?int { return $this->singlePlayer; }
}
