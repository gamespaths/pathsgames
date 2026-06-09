<?php

namespace Games\Paths\Core\Port\Matches;

use Games\Paths\Core\Domain\Matches\CharacterInstanceInfo;
use Games\Paths\Core\Domain\Matches\JoinMatchCommand;

interface CharacterCommandPort
{
    /**
     * Step 21 — instantiate the caller's character in a match. Throws
     * {@see \Games\Paths\Core\Domain\Matches\CharacterJoinException} on failure.
     */
    public function join(JoinMatchCommand $command): CharacterInstanceInfo;
}
