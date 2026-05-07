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
