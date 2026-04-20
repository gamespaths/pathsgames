<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest\Story;

use Games\Paths\Adapter\Rest\Story\StoryController;
use Games\Paths\Core\Domain\Story\StoryDetail;
use Games\Paths\Core\Domain\Story\StorySummary;
use Games\Paths\Core\Port\Story\StoryQueryPort;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class StoryControllerTest extends TestCase
{
    private $queryPort;
    private $controller;
    private $responseFactory;
    private $requestFactory;

    protected function setUp(): void
    {
        $this->queryPort = $this->createMock(StoryQueryPort::class);
        $this->controller = new StoryController($this->queryPort);
        $this->responseFactory = new ResponseFactory();
        $this->requestFactory = new ServerRequestFactory();
    }

    public function testListStories(): void
    {
        $stories = [new StorySummary('s1'), new StorySummary('s2')];
        $this->queryPort->method('listPublicStories')->with('it')->willReturn($stories);

        $request = $this->requestFactory->createServerRequest('GET', '/stories?lang=it')
            ->withQueryParams(['lang' => 'it']);
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->listStories($request, $response, []);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertCount(2, $body);
    }

    public function testGetStorySuccess(): void
    {
        $story = new StoryDetail('s1');
        $this->queryPort->method('getStoryDetail')->with('s1', 'en')->willReturn($story);

        $request = $this->requestFactory->createServerRequest('GET', '/story/s1');
        $response = $this->responseFactory->createResponse();
        $args = ['uuid' => 's1'];

        $result = $this->controller->getStory($request, $response, $args);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('s1', $body['uuid']);
    }

    public function testGetStoryNotFound(): void
    {
        $this->queryPort->method('getStoryDetail')->willReturn(null);

        $request = $this->requestFactory->createServerRequest('GET', '/story/s1');
        $response = $this->responseFactory->createResponse();
        $args = ['uuid' => 's1'];

        $result = $this->controller->getStory($request, $response, $args);

        $this->assertSame(404, $result->getStatusCode());
    }

    public function testListCategories(): void
    {
        $this->queryPort->method('listCategories')->willReturn(['Cat1', 'Cat2']);

        $request = $this->requestFactory->createServerRequest('GET', '/categories');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->listCategories($request, $response, []);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame(['Cat1', 'Cat2'], $body);
    }

    public function testListGroups(): void
    {
        $this->queryPort->method('listGroups')->willReturn(['Group1']);

        $request = $this->requestFactory->createServerRequest('GET', '/groups');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->listGroups($request, $response, []);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame(['Group1'], $body);
    }

    public function testListStoriesByCategory(): void
    {
        $this->queryPort->method('listStoriesByCategory')->with('Cat1', 'en')->willReturn([]);

        $request = $this->requestFactory->createServerRequest('GET', '/stories/category/Cat1');
        $response = $this->responseFactory->createResponse();
        $args = ['category' => 'Cat1'];

        $result = $this->controller->listStoriesByCategory($request, $response, $args);

        $this->assertSame(200, $result->getStatusCode());
    }

    public function testListStoriesByGroup(): void
    {
        $this->queryPort->method('listStoriesByGroup')->with('G1', 'en')->willReturn([]);

        $request = $this->requestFactory->createServerRequest('GET', '/stories/group/G1');
        $response = $this->responseFactory->createResponse();
        $args = ['group' => 'G1'];

        $result = $this->controller->listStoriesByGroup($request, $response, $args);

        $this->assertSame(200, $result->getStatusCode());
    }
}
