<?php

namespace Games\Paths\Core\Domain\Matches;

/**
 * Step 21 — command for POST /api/matches/{uuid}/join. Loadout fields are
 * optional; the command service falls back to the loadout stored on the match.
 */
class JoinMatchCommand
{
    /**
     * @param string[] $traitUuids
     */
    public function __construct(
        private readonly string $matchUuid,
        private readonly string $userUuid,
        private readonly ?string $characterTemplateUuid = null,
        private readonly ?string $classUuid = null,
        private readonly array $traitUuids = []
    ) {
    }

    public function getMatchUuid(): string
    {
        return $this->matchUuid;
    }

    public function getUserUuid(): string
    {
        return $this->userUuid;
    }

    public function getCharacterTemplateUuid(): ?string
    {
        return $this->characterTemplateUuid;
    }

    public function getClassUuid(): ?string
    {
        return $this->classUuid;
    }

    /** @return string[] */
    public function getTraitUuids(): array
    {
        return $this->traitUuids;
    }
}
