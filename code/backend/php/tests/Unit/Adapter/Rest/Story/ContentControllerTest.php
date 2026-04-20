<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest\Story;

use Games\Paths\Adapter\Rest\Story\ContentController;
use Games\Paths\Core\Domain\Story\CardInfo;
use Games\Paths\Core\Domain\Story\CreatorInfo;
use Games\Paths\Core\Domain\Story\TextInfo;
use Games\Paths\Core\Port\Story\ContentQueryPort;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class ContentControllerTest extends TestCase
{
    private $queryPort;
    private $controller;
    private $responseFactory;
    private $requestFactory;

    protected function setUp(): void
    {
        $this->queryPort = $this->createMock(ContentQueryPort::class);
        $this->controller = new ContentController($this->queryPort);
        $this->responseFactory = new ResponseFactory();
        $this->requestFactory = new ServerRequestFactory();
    }

    public function testGetCardSuccess(): void
    {
        $card = new CardInfo('card-uuid', 'http://image.png', null, null, null, null, 'Card Title');
        $this->queryPort->method('getCardByStoryAndCardUuid')
            ->with('story-uuid', 'card-uuid', 'en')
            ->willReturn($card);

        $request = $this->requestFactory->createServerRequest('GET', '/story/story-uuid/card/card-uuid');
        $response = $this->responseFactory->createResponse();
        $args = ['uuidStory' => 'story-uuid', 'uuidCard' => 'card-uuid'];

        $result = $this->controller->getCard($request, $response, $args);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('card-uuid', $body['uuid']);
        $this->assertSame('Card Title', $body['title']);
    }

    public function testGetCardNotFound(): void
    {
        $this->queryPort->method('getCardByStoryAndCardUuid')->willReturn(null);

        $request = $this->requestFactory->createServerRequest('GET', '/story/story-uuid/card/card-uuid');
        $response = $this->responseFactory->createResponse();
        $args = ['uuidStory' => 'story-uuid', 'uuidCard' => 'card-uuid'];

        $result = $this->controller->getCard($request, $response, $args);

        $this->assertSame(404, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('CARD_NOT_FOUND', $body['error']);
    }

    public function testGetTextSuccess(): void
    {
        $text = new TextInfo(123, 'en', 'en', 'Short text');
        $this->queryPort->method('getTextByStoryAndIdText')
            ->with('story-uuid', 123, 'en')
            ->willReturn($text);

        $request = $this->requestFactory->createServerRequest('GET', '/story/story-uuid/text/123');
        $response = $this->responseFactory->createResponse();
        $args = ['uuidStory' => 'story-uuid', 'idText' => '123', 'lang' => 'en'];

        $result = $this->controller->getText($request, $response, $args);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame(123, $body['idText']);
        $this->assertSame('Short text', $body['shortText']);
    }

    public function testGetTextNotFound(): void
    {
        $this->queryPort->method('getTextByStoryAndIdText')->willReturn(null);

        $request = $this->requestFactory->createServerRequest('GET', '/story/story-uuid/text/123');
        $response = $this->responseFactory->createResponse();
        $args = ['uuidStory' => 'story-uuid', 'idText' => '123', 'lang' => 'en'];

        $result = $this->controller->getText($request, $response, $args);

        $this->assertSame(404, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('TEXT_NOT_FOUND', $body['error']);
    }

    public function testGetCreatorSuccess(): void
    {
        $creator = new CreatorInfo('creator-uuid', 'Creator Name');
        $this->queryPort->method('getCreatorByStoryAndCreatorUuid')
            ->with('story-uuid', 'creator-uuid', 'it')
            ->willReturn($creator);

        $request = $this->requestFactory->createServerRequest('GET', '/story/story-uuid/creator/creator-uuid?lang=it');
        $request = $request->withQueryParams(['lang' => 'it']);
        $response = $this->responseFactory->createResponse();
        $args = ['uuidStory' => 'story-uuid', 'uuidCreator' => 'creator-uuid'];

        $result = $this->controller->getCreator($request, $response, $args);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('creator-uuid', $body['uuid']);
        $this->assertSame('Creator Name', $body['name']);
    }

    public function testGetCreatorNotFound(): void
    {
        $this->queryPort->method('getCreatorByStoryAndCreatorUuid')->willReturn(null);

        $request = $this->requestFactory->createServerRequest('GET', '/story/story-uuid/creator/creator-uuid');
        $response = $this->responseFactory->createResponse();
        $args = ['uuidStory' => 'story-uuid', 'uuidCreator' => 'creator-uuid'];

        $result = $this->controller->getCreator($request, $response, $args);

        $this->assertSame(404, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('CREATOR_NOT_FOUND', $body['error']);
    }
}
