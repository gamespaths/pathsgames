<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Domain\Story;

use Games\Paths\Core\Domain\Story\CardInfo;
use Games\Paths\Core\Domain\Story\CharacterTemplateInfo;
use Games\Paths\Core\Domain\Story\ClassInfo;
use Games\Paths\Core\Domain\Story\CreatorInfo;
use Games\Paths\Core\Domain\Story\DifficultyInfo;
use Games\Paths\Core\Domain\Story\StoryDetail;
use Games\Paths\Core\Domain\Story\StoryImportResult;
use Games\Paths\Core\Domain\Story\StorySummary;
use Games\Paths\Core\Domain\Story\TextInfo;
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
        $this->assertNull($c->description);
        $this->assertNull($c->copyrightText);
        $this->assertNull($c->linkCopyright);
        $this->assertNull($c->creator);
    }

    public function testCardInfoFull(): void
    {
        $cr = new CreatorInfo('cr1', 'Author');
        $c = new CardInfo('cd1', 'https://img.png', 'alt', 'fa-star', 'bg-dark', 'text-light',
            'My Card', 'A card', '(c) 2025', 'https://lic.example.com', $cr);
        $this->assertSame('cd1', $c->uuid);
        $this->assertSame('https://img.png', $c->imageUrl);
        $this->assertSame('fa-star', $c->awesomeIcon);
        $this->assertSame('My Card', $c->title);
        $this->assertSame('A card', $c->description);
        $this->assertSame('(c) 2025', $c->copyrightText);
        $this->assertSame('https://lic.example.com', $c->linkCopyright);
        $this->assertNotNull($c->creator);
        $this->assertSame('cr1', $c->creator->uuid);
        $this->assertSame('Author', $c->creator->name);
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
        $c = new CardInfo('cd1', 'https://img.png', null, 'fa-star', null, null, 'Title',
            'Desc', '(c)', 'https://lic.example.com');
        $json = json_encode($c);
        $decoded = json_decode($json, true);
        $this->assertSame('cd1', $decoded['uuid']);
        $this->assertSame('fa-star', $decoded['awesomeIcon']);
        $this->assertNull($decoded['alternativeImage']);
        $this->assertSame('Desc', $decoded['description']);
        $this->assertSame('(c)', $decoded['copyrightText']);
        $this->assertSame('https://lic.example.com', $decoded['linkCopyright']);
    }

    // ─── Step 16: CreatorInfo and TextInfo ───

    public function testCreatorInfoDefaults(): void
    {
        $c = new CreatorInfo('cr1');
        $this->assertSame('cr1', $c->uuid);
        $this->assertNull($c->name);
        $this->assertNull($c->link);
        $this->assertNull($c->url);
        $this->assertNull($c->urlImage);
        $this->assertNull($c->urlEmote);
        $this->assertNull($c->urlInstagram);
    }

    public function testCreatorInfoFull(): void
    {
        $c = new CreatorInfo('cr1', 'John', 'http://john.com', 'http://john.com/p',
            'http://john.com/img', 'http://john.com/emote', 'http://ig.com/john');
        $this->assertSame('cr1', $c->uuid);
        $this->assertSame('John', $c->name);
        $this->assertSame('http://john.com', $c->link);
        $this->assertSame('http://john.com/p', $c->url);
        $this->assertSame('http://john.com/img', $c->urlImage);
        $this->assertSame('http://john.com/emote', $c->urlEmote);
        $this->assertSame('http://ig.com/john', $c->urlInstagram);
    }

    public function testCreatorInfoJsonSerialize(): void
    {
        $c = new CreatorInfo('cr1', 'John', 'http://link');
        $json = json_encode($c);
        $decoded = json_decode($json, true);
        $this->assertSame('cr1', $decoded['uuid']);
        $this->assertSame('John', $decoded['name']);
        $this->assertSame('http://link', $decoded['link']);
        $this->assertNull($decoded['url']);
    }

    public function testTextInfoDefaults(): void
    {
        $t = new TextInfo(1, 'en', 'en');
        $this->assertSame(1, $t->idText);
        $this->assertSame('en', $t->lang);
        $this->assertSame('en', $t->resolvedLang);
        $this->assertNull($t->shortText);
        $this->assertNull($t->longText);
        $this->assertNull($t->copyrightText);
        $this->assertNull($t->linkCopyright);
        $this->assertNull($t->creator);
    }

    public function testTextInfoFull(): void
    {
        $cr = new CreatorInfo('cr1', 'Author');
        $t = new TextInfo(1, 'it', 'en', 'Hello', 'Hello World', '(c) 2025',
            'https://lic.example.com', $cr);
        $this->assertSame(1, $t->idText);
        $this->assertSame('it', $t->lang);
        $this->assertSame('en', $t->resolvedLang);
        $this->assertSame('Hello', $t->shortText);
        $this->assertSame('Hello World', $t->longText);
        $this->assertSame('(c) 2025', $t->copyrightText);
        $this->assertSame('https://lic.example.com', $t->linkCopyright);
        $this->assertNotNull($t->creator);
        $this->assertSame('cr1', $t->creator->uuid);
    }

    public function testTextInfoJsonSerialize(): void
    {
        $t = new TextInfo(1, 'en', 'en', 'Short');
        $json = json_encode($t);
        $decoded = json_decode($json, true);
        $this->assertSame(1, $decoded['idText']);
        $this->assertSame('en', $decoded['lang']);
        $this->assertSame('Short', $decoded['shortText']);
        $this->assertNull($decoded['creator']);
    }
}
