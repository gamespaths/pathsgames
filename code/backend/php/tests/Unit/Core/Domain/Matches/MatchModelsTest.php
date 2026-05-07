<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Domain\Matches;

use Games\Paths\Core\Domain\Matches\MatchCreateCommand;
use Games\Paths\Core\Domain\Matches\MatchCreationException;
use Games\Paths\Core\Domain\Matches\MatchDetail;
use Games\Paths\Core\Domain\Matches\MatchEventOption;
use Games\Paths\Core\Domain\Matches\MatchLocationState;
use Games\Paths\Core\Domain\Matches\MatchRegistryEntry;
use Games\Paths\Core\Domain\Matches\MatchSummary;
use PHPUnit\Framework\TestCase;

class MatchModelsTest extends TestCase
{
    public function testCreateCommand(): void
    {
        $cmd = new MatchCreateCommand('u', 's', 'd', 'n', 'ct');
        $this->assertSame('u', $cmd->getUserUuid());
        $this->assertSame('s', $cmd->getStoryUuid());
        $this->assertSame('d', $cmd->getDifficultyUuid());
        $this->assertSame('n', $cmd->getName());
        $this->assertSame('ct', $cmd->getCharacterTemplateUuid());
    }

    public function testCreateCommandDefaults(): void
    {
        $cmd = new MatchCreateCommand('u', 's', 'd');
        $this->assertNull($cmd->getName());
        $this->assertNull($cmd->getCharacterTemplateUuid());
    }

    public function testSummaryToArray(): void
    {
        $summary = new MatchSummary('u', 's', 'd', 'n', 'CREATED', 0, 5, 'uc', 'ts');
        $arr = $summary->toArray();
        $this->assertSame('u', $arr['uuid']);
        $this->assertSame('CREATED', $arr['status']);
        $this->assertSame(5, $arr['expCost']);
    }

    public function testLocationStateToArray(): void
    {
        $ls = new MatchLocationState(1, 'u', 0, 5, 'name');
        $arr = $ls->toArray();
        $this->assertSame(1, $arr['idLocation']);
        $this->assertSame('u', $arr['uuid']);
        $this->assertSame(5, $arr['clockCounter']);
        $this->assertSame('name', $arr['name']);
    }

    public function testRegistryEntryToArray(): void
    {
        $r = new MatchRegistryEntry('u', 'k', 'v', 7);
        $arr = $r->toArray();
        $this->assertSame('u', $arr['uuid']);
        $this->assertSame('k', $arr['key']);
        $this->assertSame('v', $arr['stringValue']);
        $this->assertSame(7, $arr['intValue']);
    }

    public function testEventOptionToArray(): void
    {
        $e = new MatchEventOption('u', 'n', 'EVENT');
        $arr = $e->toArray();
        $this->assertSame('u', $arr['uuid']);
        $this->assertSame('EVENT', $arr['type']);
    }

    public function testDetailToArray(): void
    {
        $summary = new MatchSummary('u', null, null, null, 'CREATED', 0, 0, 'uc', 'ts');
        $detail = new MatchDetail(
            match: $summary,
            currentLocationId: 1,
            currentLocationUuid: 'lu',
            currentLocationName: 'loc',
            locations: [new MatchLocationState(1, 'lu', 0, 5)],
            registry: [new MatchRegistryEntry('ru', 'k')],
            events: [new MatchEventOption('e', 'n', 'EVENT')],
            choices: [new MatchEventOption('c', 'n', 'CHOICE')]
        );
        $arr = $detail->toArray();
        $this->assertSame('u', $arr['match']['uuid']);
        $this->assertSame(1, $arr['currentLocationId']);
        $this->assertCount(1, $arr['locations']);
        $this->assertCount(1, $arr['registry']);
        $this->assertCount(1, $arr['events']);
        $this->assertCount(1, $arr['choices']);
    }

    public function testDetailDefaults(): void
    {
        $summary = new MatchSummary('u', null, null, null, 'CREATED', 0, 0, 'uc', 'ts');
        $detail = new MatchDetail(match: $summary);
        $this->assertSame([], $detail->locations);
        $this->assertSame([], $detail->registry);
        $this->assertSame([], $detail->events);
        $this->assertSame([], $detail->choices);
        $this->assertNull($detail->currentLocationId);
    }

    public function testCreationExceptionCarriesCode(): void
    {
        $exc = new MatchCreationException(MatchCreationException::USER_BANNED, 'msg');
        $this->assertSame('USER_BANNED', $exc->getCodeId());
        $this->assertSame('msg', $exc->getMessage());
    }
}
