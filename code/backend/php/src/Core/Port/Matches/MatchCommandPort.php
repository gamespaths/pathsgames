<?php

namespace Games\Paths\Core\Port\Matches;

use Games\Paths\Core\Domain\Matches\MatchCreateCommand;
use Games\Paths\Core\Domain\Matches\MatchSummary;

interface MatchCommandPort
{
    public function createMatch(MatchCreateCommand $command): MatchSummary;
}
