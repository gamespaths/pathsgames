<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Core\Service\Story;

use Games\Paths\Core\Domain\Story\CardInfo;
use Games\Paths\Core\Domain\Story\CreatorInfo;
use Games\Paths\Core\Domain\Story\TextInfo;
use Games\Paths\Core\Port\Story\StoryReadPort;
use Games\Paths\Core\Service\Story\ContentQueryService;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

class ContentQueryServiceTest extends TestCase
{
    private StoryReadPort&MockObject $readPort;
    private ContentQueryService $service;

    protected function setUp(): void
    {
        $this->readPort = $this->createMock(StoryReadPort::class);
        $this->service = new ContentQueryService($this->readPort);
    }

    // ── Card tests ──────────────────────────────────────────────────────────

    public function testGetCardEmptyStoryUuid(): void
    {
        $this->assertNull($this->service->getCardByStoryAndCardUuid('', 'card-uuid', 'en'));
    }

    public function testGetCardBlankStoryUuid(): void
    {
        $this->assertNull($this->service->getCardByStoryAndCardUuid('  ', 'card-uuid', 'en'));
    }

    public function testGetCardEmptyCardUuid(): void
    {
        $this->assertNull($this->service->getCardByStoryAndCardUuid('story-uuid', '', 'en'));
    }

    public function testGetCardBlankCardUuid(): void
    {
        $this->assertNull($this->service->getCardByStoryAndCardUuid('story-uuid', '  ', 'en'));
    }

    public function testGetCardStoryNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->getCardByStoryAndCardUuid('unknown', 'card-uuid', 'en'));
    }

    public function testGetCardCardNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findCardByStoryIdAndUuid')->willReturn(null);
        $this->assertNull($this->service->getCardByStoryAndCardUuid('s1', 'unknown', 'en'));
    }

    public function testGetCardSuccess(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findCardByStoryIdAndUuid')->willReturn([
            'uuid' => 'card-uuid', 'image_url' => 'https://img.png',
            'alternative_image' => 'alt', 'awesome_icon' => 'fa-star',
            'style_main' => 'bg-dark', 'style_detail' => 'text-light',
            'id_text_title' => 10, 'id_text_description' => 11,
            'id_text_copyright' => 12, 'link_copyright' => 'https://lic.com',
            'id_creator' => null
        ]);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 10, 'en'] => ['short_text' => 'Card Title'],
                    [1, 11, 'en'] => ['short_text' => 'Card Desc'],
                    [1, 12, 'en'] => ['short_text' => 'Card (c)'],
                    default => null
                };
            }
        );

        $card = $this->service->getCardByStoryAndCardUuid('s1', 'card-uuid', 'en');

        $this->assertNotNull($card);
        $this->assertInstanceOf(CardInfo::class, $card);
        $this->assertSame('card-uuid', $card->uuid);
        $this->assertSame('https://img.png', $card->imageUrl);
        $this->assertSame('Card Title', $card->title);
        $this->assertSame('Card Desc', $card->description);
        $this->assertSame('Card (c)', $card->copyrightText);
        $this->assertSame('https://lic.com', $card->linkCopyright);
        $this->assertNull($card->creator);
    }

    public function testGetCardWithCreator(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findCardByStoryIdAndUuid')->willReturn([
            'uuid' => 'card-uuid', 'image_url' => null,
            'alternative_image' => null, 'awesome_icon' => null,
            'style_main' => null, 'style_detail' => null,
            'id_text_title' => null, 'id_text_description' => null,
            'id_text_copyright' => null, 'link_copyright' => null,
            'id_creator' => 5
        ]);
        $this->readPort->method('findCreatorsForStory')->willReturn([
            ['id' => 5, 'uuid' => 'cr-uuid', 'id_text' => 20, 'link' => 'http://cr.com',
             'url' => 'http://cr.com/p', 'url_image' => 'http://cr.com/img',
             'url_emote' => 'http://cr.com/emote', 'url_instagram' => 'http://ig.com/cr']
        ]);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 20, 'en'] => ['short_text' => 'Creator Name'],
                    default => null
                };
            }
        );

        $card = $this->service->getCardByStoryAndCardUuid('s1', 'card-uuid', 'en');

        $this->assertNotNull($card);
        $this->assertNotNull($card->creator);
        $this->assertInstanceOf(CreatorInfo::class, $card->creator);
        $this->assertSame('cr-uuid', $card->creator->uuid);
        $this->assertSame('Creator Name', $card->creator->name);
    }

    public function testGetCardCreatorNotInList(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findCardByStoryIdAndUuid')->willReturn([
            'uuid' => 'card-uuid', 'image_url' => null,
            'alternative_image' => null, 'awesome_icon' => null,
            'style_main' => null, 'style_detail' => null,
            'id_text_title' => null, 'id_text_description' => null,
            'id_text_copyright' => null, 'link_copyright' => null,
            'id_creator' => 99
        ]);
        $this->readPort->method('findCreatorsForStory')->willReturn([
            ['id' => 5, 'uuid' => 'cr-uuid', 'id_text' => null, 'link' => null,
             'url' => null, 'url_image' => null, 'url_emote' => null, 'url_instagram' => null]
        ]);

        $card = $this->service->getCardByStoryAndCardUuid('s1', 'card-uuid', 'en');
        $this->assertNotNull($card);
        $this->assertNull($card->creator);
    }

    // ── Text tests ──────────────────────────────────────────────────────────

    public function testGetTextEmptyStoryUuid(): void
    {
        $this->assertNull($this->service->getTextByStoryAndIdText('', 1, 'en'));
    }

    public function testGetTextBlankStoryUuid(): void
    {
        $this->assertNull($this->service->getTextByStoryAndIdText('  ', 1, 'en'));
    }

    public function testGetTextStoryNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->getTextByStoryAndIdText('unknown', 1, 'en'));
    }

    public function testGetTextTextNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturn(null);
        $this->assertNull($this->service->getTextByStoryAndIdText('s1', 99999, 'en'));
    }

    public function testGetTextSuccess(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 1, 'en'] => ['id_text' => 1, 'lang' => 'en', 'short_text' => 'TUTORIAL',
                                      'long_text' => 'Full text', 'id_text_copyright' => null,
                                      'link_copyright' => null, 'id_creator' => null],
                    default => null
                };
            }
        );

        $text = $this->service->getTextByStoryAndIdText('s1', 1, 'en');

        $this->assertNotNull($text);
        $this->assertInstanceOf(TextInfo::class, $text);
        $this->assertSame(1, $text->idText);
        $this->assertSame('en', $text->lang);
        $this->assertSame('en', $text->resolvedLang);
        $this->assertSame('TUTORIAL', $text->shortText);
        $this->assertSame('Full text', $text->longText);
        $this->assertNull($text->copyrightText);
        $this->assertNull($text->creator);
    }

    public function testGetTextLanguageFallback(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 1, 'en'] => ['id_text' => 1, 'lang' => 'en', 'short_text' => 'TUTORIAL',
                                      'long_text' => null, 'id_text_copyright' => null,
                                      'link_copyright' => null, 'id_creator' => null],
                    default => null
                };
            }
        );

        $text = $this->service->getTextByStoryAndIdText('s1', 1, 'fr');

        $this->assertNotNull($text);
        $this->assertSame('fr', $text->lang);
        $this->assertSame('en', $text->resolvedLang);
        $this->assertSame('TUTORIAL', $text->shortText);
    }

    public function testGetTextNoFallbackAvailable(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturn(null);
        $this->assertNull($this->service->getTextByStoryAndIdText('s1', 1, 'fr'));
    }

    public function testGetTextBlankLangDefaultsToEn(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 1, 'en'] => ['id_text' => 1, 'lang' => 'en', 'short_text' => 'English text',
                                      'long_text' => null, 'id_text_copyright' => null,
                                      'link_copyright' => null, 'id_creator' => null],
                    default => null
                };
            }
        );

        $text = $this->service->getTextByStoryAndIdText('s1', 1, '  ');

        $this->assertNotNull($text);
        $this->assertSame('en', $text->lang);
        $this->assertSame('en', $text->resolvedLang);
    }

    public function testGetTextWithCopyrightAndCreator(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 1, 'en'] => ['id_text' => 1, 'lang' => 'en', 'short_text' => 'Text',
                                      'long_text' => null, 'id_text_copyright' => 50,
                                      'link_copyright' => 'https://lic.com', 'id_creator' => 3],
                    [1, 50, 'en'] => ['short_text' => '(c) Author'],
                    default => null
                };
            }
        );
        $this->readPort->method('findCreatorsForStory')->willReturn([
            ['id' => 3, 'uuid' => 'cr-uuid', 'id_text' => 60, 'link' => 'http://cr.com',
             'url' => null, 'url_image' => null, 'url_emote' => null, 'url_instagram' => null]
        ]);

        $text = $this->service->getTextByStoryAndIdText('s1', 1, 'en');

        $this->assertNotNull($text);
        $this->assertSame('(c) Author', $text->copyrightText);
        $this->assertSame('https://lic.com', $text->linkCopyright);
        $this->assertNotNull($text->creator);
        $this->assertSame('cr-uuid', $text->creator->uuid);
    }

    public function testGetTextItalianExactMatch(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 1, 'it'] => ['id_text' => 1, 'lang' => 'it', 'short_text' => 'Ciao',
                                      'long_text' => null, 'id_text_copyright' => null,
                                      'link_copyright' => null, 'id_creator' => null],
                    default => null
                };
            }
        );

        $text = $this->service->getTextByStoryAndIdText('s1', 1, 'it');
        $this->assertNotNull($text);
        $this->assertSame('it', $text->lang);
        $this->assertSame('it', $text->resolvedLang);
    }

    // ── Creator tests ───────────────────────────────────────────────────────

    public function testGetCreatorEmptyStoryUuid(): void
    {
        $this->assertNull($this->service->getCreatorByStoryAndCreatorUuid('', 'cr-uuid', 'en'));
    }

    public function testGetCreatorBlankStoryUuid(): void
    {
        $this->assertNull($this->service->getCreatorByStoryAndCreatorUuid('  ', 'cr-uuid', 'en'));
    }

    public function testGetCreatorEmptyCreatorUuid(): void
    {
        $this->assertNull($this->service->getCreatorByStoryAndCreatorUuid('story-uuid', '', 'en'));
    }

    public function testGetCreatorBlankCreatorUuid(): void
    {
        $this->assertNull($this->service->getCreatorByStoryAndCreatorUuid('story-uuid', '  ', 'en'));
    }

    public function testGetCreatorStoryNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(null);
        $this->assertNull($this->service->getCreatorByStoryAndCreatorUuid('unknown', 'cr-uuid', 'en'));
    }

    public function testGetCreatorCreatorNotFound(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findCreatorByStoryIdAndUuid')->willReturn(null);
        $this->assertNull($this->service->getCreatorByStoryAndCreatorUuid('s1', 'unknown', 'en'));
    }

    public function testGetCreatorSuccess(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findCreatorByStoryIdAndUuid')->willReturn([
            'uuid' => 'cr-uuid', 'id_text' => 30, 'link' => 'http://cr.com',
            'url' => 'http://cr.com/p', 'url_image' => 'http://cr.com/img',
            'url_emote' => 'http://cr.com/emote', 'url_instagram' => 'http://ig.com/cr'
        ]);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 30, 'en'] => ['short_text' => 'John Doe'],
                    default => null
                };
            }
        );

        $creator = $this->service->getCreatorByStoryAndCreatorUuid('s1', 'cr-uuid', 'en');

        $this->assertNotNull($creator);
        $this->assertInstanceOf(CreatorInfo::class, $creator);
        $this->assertSame('cr-uuid', $creator->uuid);
        $this->assertSame('John Doe', $creator->name);
        $this->assertSame('http://cr.com', $creator->link);
        $this->assertSame('http://cr.com/p', $creator->url);
        $this->assertSame('http://cr.com/img', $creator->urlImage);
        $this->assertSame('http://cr.com/emote', $creator->urlEmote);
        $this->assertSame('http://ig.com/cr', $creator->urlInstagram);
    }

    public function testGetCreatorNameFallbackToEn(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findCreatorByStoryIdAndUuid')->willReturn([
            'uuid' => 'cr-uuid', 'id_text' => 30, 'link' => null,
            'url' => null, 'url_image' => null, 'url_emote' => null, 'url_instagram' => null
        ]);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 30, 'en'] => ['short_text' => 'English Name'],
                    default => null
                };
            }
        );

        $creator = $this->service->getCreatorByStoryAndCreatorUuid('s1', 'cr-uuid', 'fr');
        $this->assertNotNull($creator);
        $this->assertSame('English Name', $creator->name);
    }

    public function testGetCreatorNoIdText(): void
    {
        $this->readPort->method('findStoryByUuid')->willReturn(['id' => 1, 'uuid' => 's1']);
        $this->readPort->method('findCreatorByStoryIdAndUuid')->willReturn([
            'uuid' => 'cr-uuid', 'id_text' => null, 'link' => null,
            'url' => null, 'url_image' => null, 'url_emote' => null, 'url_instagram' => null
        ]);

        $creator = $this->service->getCreatorByStoryAndCreatorUuid('s1', 'cr-uuid', 'en');
        $this->assertNotNull($creator);
        $this->assertNull($creator->name);
    }

    // ── resolveText helper tests ────────────────────────────────────────────

    public function testResolveTextNullIdText(): void
    {
        $this->assertNull($this->service->resolveText(1, null, 'en'));
    }

    public function testResolveTextFound(): void
    {
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 10, 'en'] => ['short_text' => 'Hello'],
                    default => null
                };
            }
        );
        $this->assertSame('Hello', $this->service->resolveText(1, 10, 'en'));
    }

    public function testResolveTextFallbackToEn(): void
    {
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 10, 'en'] => ['short_text' => 'English'],
                    default => null
                };
            }
        );
        $this->assertSame('English', $this->service->resolveText(1, 10, 'fr'));
    }

    public function testResolveTextNotFound(): void
    {
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturn(null);
        $this->assertNull($this->service->resolveText(1, 10, 'en'));
    }

    public function testResolveTextBlankLangDefaultsToEn(): void
    {
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 10, 'en'] => ['short_text' => 'English'],
                    default => null
                };
            }
        );
        $this->assertSame('English', $this->service->resolveText(1, 10, '  '));
    }

    // ── resolveCreator helper tests ─────────────────────────────────────────

    public function testResolveCreatorNullIdCreator(): void
    {
        $this->assertNull($this->service->resolveCreator(1, null, 'en'));
    }

    public function testResolveCreatorNoMatch(): void
    {
        $this->readPort->method('findCreatorsForStory')->willReturn([
            ['id' => 5, 'uuid' => 'u', 'id_text' => null, 'link' => null,
             'url' => null, 'url_image' => null, 'url_emote' => null, 'url_instagram' => null]
        ]);
        $this->assertNull($this->service->resolveCreator(1, 99, 'en'));
    }

    public function testResolveCreatorMatch(): void
    {
        $this->readPort->method('findCreatorsForStory')->willReturn([
            ['id' => 5, 'uuid' => 'cr-uuid', 'id_text' => 20, 'link' => 'http://link',
             'url' => null, 'url_image' => null, 'url_emote' => null, 'url_instagram' => null]
        ]);
        $this->readPort->method('findTextByStoryIdTextAndLang')->willReturnCallback(
            function (int $sid, int $tid, string $lang) {
                return match ([$sid, $tid, $lang]) {
                    [1, 20, 'en'] => ['short_text' => 'Name'],
                    default => null
                };
            }
        );

        $cr = $this->service->resolveCreator(1, 5, 'en');
        $this->assertNotNull($cr);
        $this->assertSame('cr-uuid', $cr->uuid);
        $this->assertSame('Name', $cr->name);
    }

    public function testResolveCreatorEmptyList(): void
    {
        $this->readPort->method('findCreatorsForStory')->willReturn([]);
        $this->assertNull($this->service->resolveCreator(1, 5, 'en'));
    }
}
