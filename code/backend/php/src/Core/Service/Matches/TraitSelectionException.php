<?php

namespace Games\Paths\Core\Service\Matches;

/**
 * TraitSelectionException — raised by {@see TraitSelectionValidator} on the
 * first violated rule; callers translate {@see getCodeId()} into their own
 * exception type (CharacterJoinException / MatchCreationException).
 */
class TraitSelectionException extends \RuntimeException
{
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
