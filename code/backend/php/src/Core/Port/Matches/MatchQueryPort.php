<?php

namespace Games\Paths\Core\Port\Matches;

use Games\Paths\Core\Domain\Matches\MatchDetail;
use Games\Paths\Core\Domain\Matches\MatchSummary;

interface MatchQueryPort
{
    /**
     * @return MatchSummary[]
     */
    public function listUserMatches(string $userUuid): array;

    public function getMatchInfo(string $matchUuid, string $userUuid): ?MatchDetail;
}
