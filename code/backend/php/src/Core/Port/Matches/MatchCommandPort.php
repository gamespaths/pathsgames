<?php

namespace Games\Paths\Core\Port\Matches;

use Games\Paths\Core\Domain\Matches\MatchCreateCommand;
use Games\Paths\Core\Domain\Matches\MatchSummary;

interface MatchCommandPort
{
    public function createMatch(MatchCreateCommand $command): MatchSummary;

    /**
     * Updates a match's status and/or name (admin operation).
     *
     * @return string one of 'UPDATED', 'NOT_FOUND', 'INVALID_STATUS'
     */
    public function updateMatch(string $uuidMatch, ?string $status, ?string $name): string;

    /**
     * Deletes a match together with its runtime state (admin operation).
     * Only matches in a terminal status (ENDED / GAMEOVER) may be deleted.
     *
     * @return string one of 'DELETED', 'NOT_FOUND', 'NOT_STOPPED'
     */
    public function deleteMatch(string $uuidMatch): string;

    /**
     * Step 20.1 — completes a match (status → ENDED) when the supplied event uuid
     * is the story's idEventEndGame. Caller must own the match.
     *
     * @return string one of 'COMPLETED', 'NOT_ACCEPTABLE', 'NOT_FOUND'
     */
    public function endMatch(string $uuidMatch, string $uuidEvent, string $userUuid): string;
}
