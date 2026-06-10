<?php

declare(strict_types=1);

namespace Games\Paths\Core\Domain\Story;

/**
 * StoryValidationException - raised by import / CRUD save paths when validation fails;
 * mapped to HTTP 400 by the admin controllers (Step 22).
 */
final class StoryValidationException extends \RuntimeException
{
    public function __construct(private readonly StoryValidationReport $report)
    {
        parent::__construct('Story validation failed: ' . $report->summary());
    }

    public function getReport(): StoryValidationReport
    {
        return $this->report;
    }
}
