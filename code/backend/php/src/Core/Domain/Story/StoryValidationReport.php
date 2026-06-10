<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

/**
 * StoryValidationReport - accumulates {@see StoryValidationError}s (Step 22).
 */
final class StoryValidationReport
{
    /** @var StoryValidationError[] */
    private array $errors = [];

    public function add(string $rule, string $entityType, ?string $entityId, ?string $field, string $message): void
    {
        $this->errors[] = new StoryValidationError($rule, $entityType, $entityId, $field, $message);
    }

    public function isValid(): bool
    {
        return count($this->errors) === 0;
    }

    /** @return StoryValidationError[] */
    public function getErrors(): array
    {
        return $this->errors;
    }

    public function summary(): string
    {
        if (empty($this->errors)) {
            return 'story is valid';
        }
        $messages = array_map(fn (StoryValidationError $e) => $e->message, array_slice($this->errors, 0, 5));
        $head = implode('; ', $messages);
        return count($this->errors) <= 5 ? $head : $head . '; (+' . (count($this->errors) - 5) . ' more)';
    }

    public function toArray(): array
    {
        return [
            'valid' => $this->isValid(),
            'count' => count($this->errors),
            'errors' => array_map(fn (StoryValidationError $e) => $e->toArray(), $this->errors),
        ];
    }
}
