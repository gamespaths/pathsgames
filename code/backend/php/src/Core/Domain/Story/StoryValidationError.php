<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

/**
 * StoryValidationError - one referential-integrity or domain-rule violation (Step 22).
 */
final class StoryValidationError
{
    public function __construct(
        public readonly string $rule,
        public readonly string $entityType,
        public readonly ?string $entityId,
        public readonly ?string $field,
        public readonly string $message
    ) {
    }

    public function toArray(): array
    {
        return [
            'rule' => $this->rule,
            'entityType' => $this->entityType,
            'entityId' => $this->entityId,
            'field' => $this->field,
            'message' => $this->message,
        ];
    }
}
