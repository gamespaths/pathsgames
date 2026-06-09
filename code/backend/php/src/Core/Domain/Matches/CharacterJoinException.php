<?php

namespace Games\Paths\Core\Domain\Matches;

class CharacterJoinException extends \RuntimeException
{
    public const INVALID_INPUT = 'INVALID_INPUT';
    public const MATCH_NOT_FOUND = 'MATCH_NOT_FOUND';
    public const USER_NOT_FOUND = 'USER_NOT_FOUND';
    public const USER_BANNED = 'USER_BANNED';
    public const TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND';
    public const CLASS_NOT_FOUND = 'CLASS_NOT_FOUND';
    public const CLASS_NOT_COMPATIBLE = 'CLASS_NOT_COMPATIBLE';
    public const ALREADY_JOINED = 'ALREADY_JOINED';
    public const MATCH_NOT_JOINABLE = 'MATCH_NOT_JOINABLE';

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
