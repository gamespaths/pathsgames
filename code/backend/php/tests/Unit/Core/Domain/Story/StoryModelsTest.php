<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Domain\Story;

use Games\Paths\Core\Domain\Story\CardInfo;
use Games\Paths\Core\Domain\Story\CharacterTemplateInfo;
use Games\Paths\Core\Domain\Story\ClassInfo;
use Games\Paths\Core\Domain\Story\DifficultyInfo;
use Games\Paths\Core\Domain\Story\StoryDetail;
use Games\Paths\Core\Domain\Story\StoryImportResult;
use Games\Paths\Core\Domain\Story\StorySummary;
use Games\Paths\Core\Domain\Story\TraitInfo;
use PHPUnit\Framework\TestCase;

class StoryModelsTest extends TestCase
{
    public function testStorySummaryDefaults(): void
    {
        $summary = new StorySummary('u1');
        $this->assertSame(0, $summary->priority);
        $this->assertNull($summary->title);
    }

    public function testDifficultyInfoDefaults(): void
    {
        $diff = new DifficultyInfo('u1');
        $this->assertSame(5, $diff->expCost);
        $this->assertSame(10, $diff->maxWeight);
    }

    public function testStoryDetailDefaults(): void
    {
        $detail = new StoryDetail('u1');
        $this->assertSame(0, $detail->locationCount);
        $this->assertIsArray($detail->difficulties);
        $this->assertEmpty($detail->difficulties);
        $this->assertIsArray($detail->classes);
        $this->assertEmpty($detail->classes);
        $this->assertIsArray($detail->characterTemplates);
        $this->assertEmpty($detail->characterTemplates);
        $this->assertIsArray($detail->traits);
        $this->assertEmpty($detail->traits);
        $this->assertNull($detail->card);
    }

    public function testStoryDetailWithCard(): void
    {
        $card = new CardInfo('c1', 'https://img.png', null, null, null, null, 'T');
        $detail = new StoryDetail('u1', card: $card);
        $this->assertNotNull($detail->card);
        $this->assertSame('c1', $detail->card->uuid);
        $this->assertSame('https://img.png', $detail->card->imageUrl);
    }

    public function testStoryImportResultDefaults(): void
    {
        $result = new StoryImportResult('u1', 'IMPORTED');
        $this->assertSame(0, $result->textsImported);
        $this->assertSame(0, $result->locationsImported);
    }

    public function testClassInfoDefaults(): void
    {
        $c = new ClassInfo('cls1');
        $this->assertNull($c->name);
        $this->assertNull($c->description);
        $this->assertSame(0, $c->weightMax);
        $this->assertSame(0, $c->dexterityBase);
        $this->assertSame(0, $c->intelligenceBase);
        $this->assertSame(0, $c->constitutionBase);
    }

    public function testClassInfoFull(): void
    {
        $c = new ClassInfo('cls1', 'Knight', 'Noble', 15, 2, 1, 3);
        $this->assertSame('cls1', $c->uuid);
        $this->assertSame('Knight', $c->name);
        $this->assertSame(15, $c->weightMax);
    }

    public function testCharacterTemplateInfoDefaults(): void
    {
        $t = new CharacterTemplateInfo('ct1');
        $this->assertNull($t->name);
        $this->assertSame(0, $t->lifeMax);
        $this->assertSame(0, $t->energyMax);
        $this->assertSame(0, $t->sadMax);
        $this->assertSame(0, $t->dexterityStart);
        $this->assertSame(0, $t->intelligenceStart);
        $this->assertSame(0, $t->constitutionStart);
    }

    public function testCharacterTemplateInfoFull(): void
    {
        $t = new CharacterTemplateInfo('ct1', 'Warrior', 'Strong', 20, 10, 5, 2, 1, 3);
        $this->assertSame('ct1', $t->uuid);
        $this->assertSame('Warrior', $t->name);
        $this->assertSame(20, $t->lifeMax);
        $this->assertSame(3, $t->constitutionStart);
    }

    public function testTraitInfoDefaults(): void
    {
        $t = new TraitInfo('tr1');
        $this->assertNull($t->name);
        $this->assertSame(0, $t->costPositive);
        $this->assertSame(0, $t->costNegative);
        $this->assertNull($t->idClassPermitted);
        $this->assertNull($t->idClassProhibited);
    }

    public function testTraitInfoFull(): void
    {
        $t = new TraitInfo('tr1', 'Brave', 'Fearless', 2, 1, 3, 5);
        $this->assertSame('tr1', $t->uuid);
        $this->assertSame(2, $t->costPositive);
        $this->assertSame(3, $t->idClassPermitted);
        $this->assertSame(5, $t->idClassProhibited);
    }

    public function testCardInfoDefaults(): void
    {
        $c = new CardInfo('cd1');
        $this->assertNull($c->imageUrl);
        $this->assertNull($c->alternativeImage);
        $this->assertNull($c->awesomeIcon);
        $this->assertNull($c->styleMain);
        $this->assertNull($c->styleDetail);
        $this->assertNull($c->title);
    }

    public function testCardInfoFull(): void
    {
        $c = new CardInfo('cd1', 'https://img.png', 'alt', 'fa-star', 'bg-dark', 'text-light', 'My Card');
        $this->assertSame('cd1', $c->uuid);
        $this->assertSame('https://img.png', $c->imageUrl);
        $this->assertSame('fa-star', $c->awesomeIcon);
        $this->assertSame('My Card', $c->title);
    }

    public function testClassInfoJsonSerialize(): void
    {
        $c = new ClassInfo('cls1', 'Knight', 'Noble', 15, 2, 1, 3);
        $json = json_encode($c);
        $decoded = json_decode($json, true);
        $this->assertSame('cls1', $decoded['uuid']);
        $this->assertSame('Knight', $decoded['name']);
        $this->assertSame(15, $decoded['weightMax']);
    }

    public function testCardInfoJsonSerialize(): void
    {
        $c = new CardInfo('cd1', 'https://img.png', null, 'fa-star', null, null, 'Title');
        $json = json_encode($c);
        $decoded = json_decode($json, true);
        $this->assertSame('cd1', $decoded['uuid']);
        $this->assertSame('fa-star', $decoded['awesomeIcon']);
        $this->assertNull($decoded['alternativeImage']);
    }
}
