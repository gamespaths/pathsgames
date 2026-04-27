<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest\Story;

use Games\Paths\Adapter\Rest\Story\StoryAdminController;
use Games\Paths\Core\Domain\Story\StoryImportResult;
use Games\Paths\Core\Domain\Story\StorySummary;
use Games\Paths\Core\Port\Story\StoryImportPort;
use Games\Paths\Core\Port\Story\StoryQueryPort;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class StoryAdminControllerTest extends TestCase
{
    private $queryPort;
    private $importPort;
    private $controller;
    private $responseFactory;
    private $requestFactory;

    protected function setUp(): void
    {
        $this->queryPort = $this->createMock(StoryQueryPort::class);
        $this->importPort = $this->createMock(StoryImportPort::class);
        $this->controller = new StoryAdminController($this->queryPort, $this->importPort);
        $this->responseFactory = new ResponseFactory();
        $this->requestFactory = new ServerRequestFactory();
    }

    public function testListAllStoriesAsAdmin(): void
    {
        $story = $this->createMock(StorySummary::class);
        $this->queryPort->method('listAllStories')->with('en')->willReturn([$story]);

        $request = $this->requestFactory->createServerRequest('GET', '/api/admin/stories')
            ->withAttribute('role', 'ADMIN');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->listAllStories($request, $response, []);

        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertCount(1, $body);
    }

    public function testListAllStoriesForbidden(): void
    {
        $request = $this->requestFactory->createServerRequest('GET', '/api/admin/stories')
            ->withAttribute('role', 'PLAYER');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->listAllStories($request, $response, []);

        $this->assertSame(403, $result->getStatusCode());
    }

    public function testImportStorySuccess(): void
    {
        $importResult = new StoryImportResult('u1', 'SUCCESS');
        $this->importPort->method('importStory')->willReturn($importResult);

        $request = $this->requestFactory->createServerRequest('POST', '/api/admin/stories/import')
            ->withAttribute('role', 'ADMIN')
            ->withParsedBody(['uuid' => 'u1']);
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->importStory($request, $response, []);

        $this->assertSame(201, $result->getStatusCode());
    }

    public function testImportStoryEmptyData(): void
    {
        $request = $this->requestFactory->createServerRequest('POST', '/api/admin/stories/import')
            ->withAttribute('role', 'ADMIN')
            ->withParsedBody([]);
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->importStory($request, $response, []);

        $this->assertSame(400, $result->getStatusCode());
    }

    public function testImportStoryInvalidData(): void
    {
        $this->importPort->method('importStory')->willThrowException(new InvalidArgumentException('Invalid'));

        $request = $this->requestFactory->createServerRequest('POST', '/api/admin/stories/import')
            ->withAttribute('role', 'ADMIN')
            ->withParsedBody(['bad' => 'data']);
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->importStory($request, $response, []);

        $this->assertSame(400, $result->getStatusCode());
    }

    public function testDeleteStorySuccess(): void
    {
        $this->importPort->method('deleteStory')->with('u1')->willReturn(true);

        $request = $this->requestFactory->createServerRequest('DELETE', '/api/admin/stories/u1')
            ->withAttribute('role', 'ADMIN');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->deleteStory($request, $response, ['uuid' => 'u1']);

        $this->assertSame(200, $result->getStatusCode());
    }

    public function testDeleteStoryNotFound(): void
    {
        $this->importPort->method('deleteStory')->with('u1')->willReturn(false);

        $request = $this->requestFactory->createServerRequest('DELETE', '/api/admin/stories/u1')
            ->withAttribute('role', 'ADMIN');
        $response = $this->responseFactory->createResponse();

        $result = $this->controller->deleteStory($request, $response, ['uuid' => 'u1']);

        $this->assertSame(404, $result->getStatusCode());
    }
}
