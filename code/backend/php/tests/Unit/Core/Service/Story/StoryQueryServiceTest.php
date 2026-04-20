<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Story;

use Games\Paths\Core\Domain\Story\CardInfo;
use Games\Paths\Core\Domain\Story\CharacterTemplateInfo;
use Games\Paths\Core\Domain\Story\ClassInfo;
use Games\Paths\Core\Domain\Story\TraitInfo;
use Games\Paths\Core\Port\Story\StoryReadPort;
use Games\Paths\Core\Service\Story\StoryQueryService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class StoryQueryServiceTest extends TestCase
{
    private StoryReadPort&MockObject $readPort;
    private StoryQueryService $service;

    protected function setUp(): void
    {
        $this->readPort = $this->createMock(StoryReadPort::class);
        $this->service = new StoryQueryService($this->readPort);
    }

    private function setUpDefaultMocks(array $overrides = []): void
    {
        if (!isset($overrides['findDifficultiesForStory'])) {
            $this->readPort->method('findDifficultiesForStory')->willReturn([]);
        }
        if (!isset($overrides['countLocationsForStory'])) {
            $this->readPort->method('countLocationsForStory')->willReturn(0);
        }
        if (!isset($overrides['countEventsForStory'])) {
            $this->readPort->method('countEventsForStory')->willReturn(0);
        }
        if (!isset($overrides['countItemsForStory'])) {
            $this->readPort->method('countItemsForStory')->willReturn(0);
        }
        if (!isset($overrides['findClassesForStory'])) {
            $this->readPort->method('findClassesForStory')->willReturn([]);
        }
        if (!isset($overrides['findCharacterTemplatesForStory'])) {
            $this->readPort->method('findCharacterTemplatesForStory')->willReturn([]);
        }
        if (!isset($overrides['findTraitsForStory'])) {
            $this->readPort->method('findTraitsForStory')->willReturn([]);
        }
    }

    public function testListPublicStoriesEmpty(): void
    {
        $this->readPort->method('findPublicStories')->willReturn([]);
        $this->assertEmpty($this->service->listPublicStories());
    }

    public function testListPublicStoriesWithData(): void
    {
        $this->readPort->method('findPublicStories')->willReturn([
            ['id' => 1, 'uuid' => 'u1', 'id_text_title' => 10]
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Story T']
        ]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([]);

        $results = $this->service->listPublicStories();
        $this->assertCount(1, $results);
        $this->assertSame('Story T', $results[0]->title);
        $this->assertSame('u1', $results[0]->uuid);
        $this->assertNull($results[0]->card);
    }

    public function testListPublicStoriesWithCard(): void
    {
        $this->readPort->method('findPublicStories')->willReturn([
            ['id' => 1, 'uuid' => 'u1', 'id_text_title' => 10, 'id_card' => 42]
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Story T'],
            ['id_text' => 400, 'lang' => 'en', 'short_text' => 'Card Title'],
            ['id_text' => 401, 'lang' => 'en', 'short_text' => 'Card Desc']
        ]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([]);
        $this->readPort->method('findCardForStory')->willReturn([
            'id' => 42, 'uuid' => 'card-uuid', 'image_url' => 'https://img.png',
            'alternative_image' => 'alt', 'awesome_icon' => 'fa-star',
            'style_main' => 'bg-dark', 'style_detail' => 'text-light',
            'id_text_title' => 400, 'id_text_description' => 401,
            'link_copyright' => 'https://lic.example.com'
        ]);

        $results = $this->service->listPublicStories();
        $this->assertCount(1, $results);
        $this->assertNotNull($results[0]->card);
        $this->assertInstanceOf(CardInfo::class, $results[0]->card);
        $this->assertSame('card-uuid', $results[0]->card->uuid);
        $this->assertSame('https://img.png', $results[0]->card->imageUrl);
        $this->assertSame('Card Title', $results[0]->card->title);
        $this->assertSame('Card Desc', $results[0]->card->description);
        $this->assertSame('fa-star', $results[0]->card->awesomeIcon);
    }

    public function testListPublicStoriesCardNotFound(): void
    {
        $this->readPort->method('findPublicStories')->willReturn([
            ['id' => 1, 'uuid' => 'u1', 'id_text_title' => 10, 'id_card' => 99]
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Story T']
        ]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([]);
        $this->readPort->method('findCardForStory')->willReturn(null);

        $results = $this->service->listPublicStories();
        $this->assertCount(1, $results);
        $this->assertNull($results[0]->card);
    }

    public function testListAllStories(): void
    {
        $this->readPort->method('findAllStories')->willReturn([
            ['id' => 1, 'uuid' => 'u1', 'visibility' => 'PRIVATE']
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([]);

        $results = $this->service->listAllStories();
        $this->assertCount(1, $results);
        $this->assertSame('PRIVATE', $results[0]->visibility);
    }

    public function testGetStoryDetailNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->getStoryDetail('u1'));
    }

    public function testGetStoryDetailSuccess(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10, 'peghi' => 2
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'long_text' => 'Title Long']
        ]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([
            ['uuid' => 'd1', 'exp_cost' => 5]
        ]);
        $this->readPort->method('countLocationsForStory')->willReturn(5);
        $this->readPort->method('countEventsForStory')->willReturn(0);
        $this->readPort->method('countItemsForStory')->willReturn(0);
        $this->readPort->method('findClassesForStory')->willReturn([]);
        $this->readPort->method('findCharacterTemplatesForStory')->willReturn([]);
        $this->readPort->method('findTraitsForStory')->willReturn([]);

        $detail = $this->service->getStoryDetail('u1', 'en');

        $this->assertNotNull($detail);
        $this->assertSame('Title Long', $detail->title);
        $this->assertSame(2, $detail->peghi);
        $this->assertSame(5, $detail->locationCount);
        $this->assertCount(1, $detail->difficulties);
        $this->assertSame(5, $detail->difficulties[0]->expCost);
    }

    public function testResolveTextFallback(): void
    {
        $texts = [
            ['id_text' => 10, 'lang' => 'it', 'short_text' => 'Titolo']
        ];
        $this->assertSame('Titolo', $this->service->resolveText($texts, 10, 'en'));
    }

    public function testResolveTextEnFallback(): void
    {
        $texts = [
            ['id_text' => 10, 'lang' => 'it', 'short_text' => 'Titolo'],
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title']
        ];
        $this->assertSame('Title', $this->service->resolveText($texts, 10, 'fr'));
    }

    public function testResolveTextNullId(): void
    {
        $this->assertNull($this->service->resolveText([], null, 'en'));
    }

    public function testResolveTextNoCandidates(): void
    {
        $this->assertNull($this->service->resolveText([['id_text' => 99]], 10, 'en'));
    }

    // ─── Step 15: Categories & Groups ───

    public function testListCategoriesEmpty(): void
    {
        $this->readPort->method('findUniqueCategories')->willReturn([]);
        $this->assertEmpty($this->service->listCategories());
    }

    public function testListCategoriesWithData(): void
    {
        $this->readPort->method('findUniqueCategories')->willReturn(['adventure', 'horror']);
        $cats = $this->service->listCategories();
        $this->assertSame(['adventure', 'horror'], $cats);
    }

    public function testListGroupsEmpty(): void
    {
        $this->readPort->method('findUniqueGroups')->willReturn([]);
        $this->assertEmpty($this->service->listGroups());
    }

    public function testListGroupsWithData(): void
    {
        $this->readPort->method('findUniqueGroups')->willReturn(['dark', 'fantasy']);
        $grps = $this->service->listGroups();
        $this->assertSame(['dark', 'fantasy'], $grps);
    }

    public function testListStoriesByCategory(): void
    {
        $this->readPort->method('findStoriesByCategory')->willReturn([
            ['id' => 1, 'uuid' => 'u1', 'id_text_title' => 10, 'category' => 'adventure']
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Adv Story']
        ]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([]);

        $results = $this->service->listStoriesByCategory('adventure');
        $this->assertCount(1, $results);
        $this->assertSame('adventure', $results[0]->category);
        $this->assertSame('Adv Story', $results[0]->title);
    }

    public function testListStoriesByCategoryEmpty(): void
    {
        $this->readPort->method('findStoriesByCategory')->willReturn([]);
        $this->assertEmpty($this->service->listStoriesByCategory('noexist'));
    }

    public function testListStoriesByGroup(): void
    {
        $this->readPort->method('findStoriesByGroup')->willReturn([
            ['id' => 2, 'uuid' => 'u2', 'id_text_title' => 20, 'group_name' => 'fantasy']
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 20, 'lang' => 'en', 'short_text' => 'Fantasy Story']
        ]);
        $this->readPort->method('findDifficultiesForStory')->willReturn([]);

        $results = $this->service->listStoriesByGroup('fantasy');
        $this->assertCount(1, $results);
        $this->assertSame('fantasy', $results[0]->group);
        $this->assertSame('Fantasy Story', $results[0]->title);
    }

    public function testListStoriesByGroupEmpty(): void
    {
        $this->readPort->method('findStoriesByGroup')->willReturn([]);
        $this->assertEmpty($this->service->listStoriesByGroup('noexist'));
    }

    // ─── Step 15: Enriched detail (classes, templates, traits, card) ───

    public function testGetStoryDetailWithClasses(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title'],
            ['id_text' => 100, 'lang' => 'en', 'short_text' => 'Knight'],
            ['id_text' => 101, 'lang' => 'en', 'short_text' => 'A noble warrior']
        ]);
        $this->readPort->method('findClassesForStory')->willReturn([
            ['id' => 1, 'uuid' => 'cls-uuid', 'id_text_name' => 100, 'id_text_description' => 101,
             'weight_max' => 15, 'dexterity_base' => 2, 'intelligence_base' => 1, 'constitution_base' => 3]
        ]);
        $this->setUpDefaultMocks(['findClassesForStory' => true]);

        $detail = $this->service->getStoryDetail('u1', 'en');

        $this->assertSame(1, $detail->classCount);
        $this->assertCount(1, $detail->classes);
        $cls = $detail->classes[0];
        $this->assertInstanceOf(ClassInfo::class, $cls);
        $this->assertSame('cls-uuid', $cls->uuid);
        $this->assertSame('Knight', $cls->name);
        $this->assertSame('A noble warrior', $cls->description);
        $this->assertSame(15, $cls->weightMax);
        $this->assertSame(2, $cls->dexterityBase);
        $this->assertSame(1, $cls->intelligenceBase);
        $this->assertSame(3, $cls->constitutionBase);
    }

    public function testGetStoryDetailWithCharacterTemplates(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title'],
            ['id_text' => 200, 'lang' => 'en', 'short_text' => 'Warrior'],
            ['id_text' => 201, 'lang' => 'en', 'short_text' => 'A strong fighter']
        ]);
        $this->readPort->method('findCharacterTemplatesForStory')->willReturn([
            ['id' => 1, 'uuid' => 'ct-uuid', 'id_text_name' => 200, 'id_text_description' => 201,
             'life_max' => 20, 'energy_max' => 10, 'sad_max' => 5,
             'dexterity_start' => 2, 'intelligence_start' => 1, 'constitution_start' => 3]
        ]);
        $this->setUpDefaultMocks(['findCharacterTemplatesForStory' => true]);

        $detail = $this->service->getStoryDetail('u1', 'en');

        $this->assertSame(1, $detail->characterTemplateCount);
        $this->assertCount(1, $detail->characterTemplates);
        $tpl = $detail->characterTemplates[0];
        $this->assertInstanceOf(CharacterTemplateInfo::class, $tpl);
        $this->assertSame('ct-uuid', $tpl->uuid);
        $this->assertSame('Warrior', $tpl->name);
        $this->assertSame(20, $tpl->lifeMax);
        $this->assertSame(10, $tpl->energyMax);
        $this->assertSame(5, $tpl->sadMax);
        $this->assertSame(2, $tpl->dexterityStart);
        $this->assertSame(1, $tpl->intelligenceStart);
        $this->assertSame(3, $tpl->constitutionStart);
    }

    public function testGetStoryDetailWithTraits(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title'],
            ['id_text' => 300, 'lang' => 'en', 'short_text' => 'Brave'],
            ['id_text' => 301, 'lang' => 'en', 'short_text' => 'Fearless']
        ]);
        $this->readPort->method('findTraitsForStory')->willReturn([
            ['id' => 1, 'uuid' => 'tr-uuid', 'id_text_name' => 300, 'id_text_description' => 301,
             'cost_positive' => 2, 'cost_negative' => 0, 'id_class_permitted' => null, 'id_class_prohibited' => 5]
        ]);
        $this->setUpDefaultMocks(['findTraitsForStory' => true]);

        $detail = $this->service->getStoryDetail('u1', 'en');

        $this->assertSame(1, $detail->traitCount);
        $this->assertCount(1, $detail->traits);
        $tr = $detail->traits[0];
        $this->assertInstanceOf(TraitInfo::class, $tr);
        $this->assertSame('tr-uuid', $tr->uuid);
        $this->assertSame('Brave', $tr->name);
        $this->assertSame(2, $tr->costPositive);
        $this->assertSame(0, $tr->costNegative);
        $this->assertNull($tr->idClassPermitted);
        $this->assertSame(5, $tr->idClassProhibited);
    }

    public function testGetStoryDetailWithCard(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10, 'id_card' => 42
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title'],
            ['id_text' => 400, 'lang' => 'en', 'short_text' => 'Card Title'],
            ['id_text' => 401, 'lang' => 'en', 'short_text' => 'Card Desc'],
            ['id_text' => 402, 'lang' => 'en', 'short_text' => 'Card (c)']
        ]);
        $this->setUpDefaultMocks();
        $this->readPort->method('findCardForStory')->willReturn([
            'id' => 42, 'uuid' => 'card-uuid', 'image_url' => 'https://img.png',
            'alternative_image' => 'alt-img', 'awesome_icon' => 'fa-star',
            'style_main' => 'bg-dark', 'style_detail' => 'text-light',
            'id_text_title' => 400, 'id_text_description' => 401,
            'id_text_copyright' => 402, 'link_copyright' => 'https://lic.example.com'
        ]);

        $detail = $this->service->getStoryDetail('u1', 'en');

        $this->assertNotNull($detail->card);
        $this->assertInstanceOf(CardInfo::class, $detail->card);
        $this->assertSame('card-uuid', $detail->card->uuid);
        $this->assertSame('https://img.png', $detail->card->imageUrl);
        $this->assertSame('alt-img', $detail->card->alternativeImage);
        $this->assertSame('fa-star', $detail->card->awesomeIcon);
        $this->assertSame('bg-dark', $detail->card->styleMain);
        $this->assertSame('text-light', $detail->card->styleDetail);
        $this->assertSame('Card Title', $detail->card->title);
        $this->assertSame('Card Desc', $detail->card->description);
        $this->assertSame('Card (c)', $detail->card->copyrightText);
        $this->assertSame('https://lic.example.com', $detail->card->linkCopyright);
    }

    public function testGetStoryDetailWithoutCard(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title']
        ]);
        $this->setUpDefaultMocks();

        $detail = $this->service->getStoryDetail('u1', 'en');
        $this->assertNull($detail->card);
    }

    public function testGetStoryDetailCardNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10, 'id_card' => 99
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title']
        ]);
        $this->setUpDefaultMocks();
        $this->readPort->method('findCardForStory')->willReturn(null);

        $detail = $this->service->getStoryDetail('u1', 'en');
        $this->assertNull($detail->card);
    }

    public function testGetStoryDetailCardUsesIdTextNameFallback(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10, 'id_card' => 42
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title'],
            ['id_text' => 500, 'lang' => 'en', 'short_text' => 'Name Fallback']
        ]);
        $this->setUpDefaultMocks();
        $this->readPort->method('findCardForStory')->willReturn([
            'id' => 42, 'uuid' => 'card-uuid', 'image_url' => null,
            'id_text_name' => 500
        ]);

        $detail = $this->service->getStoryDetail('u1', 'en');
        $this->assertNotNull($detail->card);
        $this->assertSame('Name Fallback', $detail->card->title);
    }

    public function testGetStoryDetailClassUuidFallbackToId(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title']
        ]);
        $this->readPort->method('findClassesForStory')->willReturn([
            ['id' => 99, 'id_text_name' => null, 'id_text_description' => null]
        ]);
        $this->setUpDefaultMocks(['findClassesForStory' => true]);

        $detail = $this->service->getStoryDetail('u1', 'en');
        $this->assertSame('99', $detail->classes[0]->uuid);
    }

    public function testGetStoryDetailTraitNullStatDefaults(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn([
            'id' => 1, 'uuid' => 'u1', 'id_text_title' => 10
        ]);
        $this->readPort->method('findTextsForStory')->willReturn([
            ['id_text' => 10, 'lang' => 'en', 'short_text' => 'Title']
        ]);
        $this->readPort->method('findTraitsForStory')->willReturn([
            ['id' => 1, 'uuid' => 'tr-1', 'id_text_name' => null, 'id_text_description' => null]
        ]);
        $this->setUpDefaultMocks(['findTraitsForStory' => true]);

        $detail = $this->service->getStoryDetail('u1', 'en');
        $this->assertSame(0, $detail->traits[0]->costPositive);
        $this->assertSame(0, $detail->traits[0]->costNegative);
    }
}
