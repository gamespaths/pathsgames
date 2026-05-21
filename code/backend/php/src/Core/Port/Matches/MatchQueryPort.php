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

    /**
     * Returns every match in the platform, newest first (admin view).
     * @return MatchSummary[]
     */
    public function listAllMatches(): array;

    public function getMatchInfo(string $matchUuid, string $userUuid): ?MatchDetail;

    /**
     * Returns the full match detail for the admin view — without the per-user
     * ownership check. Returns null only when the match does not exist.
     */
    public function getMatchInfoForAdmin(string $matchUuid): ?MatchDetail;
}
