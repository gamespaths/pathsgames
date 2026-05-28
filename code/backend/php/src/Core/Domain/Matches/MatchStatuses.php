<?php

namespace Games\Paths\Core\Domain\Matches;

/**
 * MatchStatuses - the lifecycle statuses of a gaming_match row.
 *
 * A match is "stopped" (terminal) when it is ENDED or GAMEOVER; only stopped
 * matches may be deleted by an admin.
 */
final class MatchStatuses
{
    public const CREATED  = 'CREATED';
    public const RUNNING  = 'RUNNING';
    public const PAUSED   = 'PAUSED';
    public const ENDED    = 'ENDED';
    public const GAMEOVER = 'GAMEOVER';

    /** Every valid status, in lifecycle order. */
    public const ALL = [self::CREATED, self::RUNNING, self::PAUSED, self::ENDED, self::GAMEOVER];

    /** Terminal statuses — a match in one of these is "stopped" and deletable. */
    public const TERMINAL = [self::ENDED, self::GAMEOVER];

    private function __construct()
    {
    }

    public static function isValid(?string $status): bool
    {
        return $status !== null && in_array($status, self::ALL, true);
    }

    public static function isTerminal(?string $status): bool
    {
        return $status !== null && in_array($status, self::TERMINAL, true);
    }
}
