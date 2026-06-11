<?php

namespace Games\Paths\Core\Domain\Matches;

class MatchCreationException extends \RuntimeException
{
    public const INVALID_INPUT = 'INVALID_INPUT';
    public const STORY_NOT_FOUND = 'STORY_NOT_FOUND';
    public const DIFFICULTY_NOT_FOUND = 'DIFFICULTY_NOT_FOUND';
    public const USER_NOT_FOUND = 'USER_NOT_FOUND';
    public const USER_BANNED = 'USER_BANNED';
    public const MAINTENANCE_MODE = 'MAINTENANCE_MODE';
    public const STORY_HAS_NO_LOCATIONS = 'STORY_HAS_NO_LOCATIONS';
    public const TURNSTILE_VALIDATION_FAILED = 'TURNSTILE_VALIDATION_FAILED';
    // Step 23 — trait selection validation on the creator loadout
    public const TRAIT_NOT_FOUND = 'TRAIT_NOT_FOUND';
    public const TRAIT_DUPLICATED = 'TRAIT_DUPLICATED';
    public const TRAIT_NOT_COMPATIBLE = 'TRAIT_NOT_COMPATIBLE';
    public const TRAIT_COST_EXCEEDED = 'TRAIT_COST_EXCEEDED';

    private string $code_id;

    public function __construct(string $codeId, string $message)
    {
        parent::__construct($message);
        $this->code_id = $codeId;
    }

    public function getCodeId(): string
    {
        return $this->code_id;
    }
}
