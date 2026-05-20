<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest\Matches;

use Games\Paths\Adapter\Rest\Matches\MatchController;
use Games\Paths\Core\Domain\Matches\MatchCreationException;
use Games\Paths\Core\Domain\Matches\MatchDetail;
use Games\Paths\Core\Domain\Matches\MatchEventOption;
use Games\Paths\Core\Domain\Matches\MatchLocationState;
use Games\Paths\Core\Domain\Matches\MatchRegistryEntry;
use Games\Paths\Core\Domain\Matches\MatchSummary;
use Games\Paths\Core\Port\Matches\MatchCommandPort;
use Games\Paths\Core\Port\Matches\MatchQueryPort;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class MatchControllerTest extends TestCase
{
    private $commandPort;
    private $queryPort;
    private MatchController $controller;
    private ResponseFactory $responseFactory;
    private ServerRequestFactory $requestFactory;

    protected function setUp(): void
    {
        $this->commandPort = $this->createMock(MatchCommandPort::class);
        $this->queryPort = $this->createMock(MatchQueryPort::class);
        $this->controller = new MatchController($this->commandPort, $this->queryPort);
        $this->responseFactory = new ResponseFactory();
        $this->requestFactory = new ServerRequestFactory();
    }

    private function summary(): MatchSummary
    {
        return new MatchSummary(
            'match-uuid', 'story-uuid', 'diff-uuid', 'n', 'CREATED', 0, 5, 'user-uuid', 'now',
            1, 'ct', 'cl', ['t1', 't2']
        );
    }

    private function detail(): MatchDetail
    {
        return new MatchDetail(
            match: $this->summary(),
            currentLocationId: 10,
            currentLocationUuid: 'loc',
            currentLocationName: 'loc-10',
            locations: [new MatchLocationState(10, 'ls', 0, 5, 'loc-10')],
            registry: [new MatchRegistryEntry('r', 'k', null, 1)],
            events: [new MatchEventOption('e', 'n', 'EVENT')],
            choices: [new MatchEventOption('c', 'n', 'CHOICE')]
        );
    }

    private function authedRequest(string $method, string $path, array $body = null)
    {
        $req = $this->requestFactory->createServerRequest($method, $path)
            ->withAttribute('userUuid', 'user-uuid');
        if ($body !== null) {
            $req = $req->withParsedBody($body);
        }
        return $req;
    }

    public function testCreateMatchUnauthenticated(): void
    {
        $request = $this->requestFactory->createServerRequest('POST', '/api/matches')
            ->withParsedBody(['storyUuid' => 's', 'difficultyUuid' => 'd']);
        $response = $this->responseFactory->createResponse();
        $result = $this->controller->createMatch($request, $response);
        $this->assertSame(401, $result->getStatusCode());
    }

    public function testCreateMatchEmptyBody(): void
    {
        $request = $this->authedRequest('POST', '/api/matches', []);
        $result = $this->controller->createMatch($request, $this->responseFactory->createResponse());
        $this->assertSame(400, $result->getStatusCode());
    }

    public function testCreateMatchMissingStory(): void
    {
        $request = $this->authedRequest('POST', '/api/matches', ['difficultyUuid' => 'd']);
        $result = $this->controller->createMatch($request, $this->responseFactory->createResponse());
        $this->assertSame(400, $result->getStatusCode());
    }

    public function testCreateMatchMissingDifficulty(): void
    {
        $request = $this->authedRequest('POST', '/api/matches', ['storyUuid' => 's']);
        $result = $this->controller->createMatch($request, $this->responseFactory->createResponse());
        $this->assertSame(400, $result->getStatusCode());
    }

    public function testCreateMatchSuccess(): void
    {
        $this->commandPort->method('createMatch')->willReturn($this->summary());
        $request = $this->authedRequest('POST', '/api/matches', [
            'storyUuid' => 's', 'difficultyUuid' => 'd', 'name' => 'n'
        ]);
        $result = $this->controller->createMatch($request, $this->responseFactory->createResponse());
        $this->assertSame(201, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('match-uuid', $body['uuid']);
        $this->assertSame(1, $body['singlePlayer']);
        $this->assertSame('cl', $body['classUuid']);
        $this->assertSame(['t1', 't2'], $body['traitUuids']);
    }

    public function testCreateMatchPassesLoadoutToCommand(): void
    {
        $captured = null;
        $this->commandPort->method('createMatch')->willReturnCallback(
            function ($command) use (&$captured) {
                $captured = $command;
                return $this->summary();
            }
        );
        $request = $this->authedRequest('POST', '/api/matches', [
            'storyUuid' => 's',
            'difficultyUuid' => 'd',
            'characterTemplateUuid' => 'ct',
            'classUuid' => 'cl',
            'traitUuids' => ['t1', 't2'],
            'singlePlayer' => 0,
        ]);
        $result = $this->controller->createMatch($request, $this->responseFactory->createResponse());
        $this->assertSame(201, $result->getStatusCode());
        $this->assertSame('ct', $captured->getCharacterTemplateUuid());
        $this->assertSame('cl', $captured->getClassUuid());
        $this->assertSame(['t1', 't2'], $captured->getTraitUuids());
        $this->assertSame(0, $captured->getSinglePlayer());
    }

    /**
     * @dataProvider errorCodes
     */
    public function testCreateMatchErrorCodes(string $code, int $expectedStatus): void
    {
        $this->commandPort->method('createMatch')
            ->willThrowException(new MatchCreationException($code, 'msg'));
        $request = $this->authedRequest('POST', '/api/matches', [
            'storyUuid' => 's', 'difficultyUuid' => 'd'
        ]);
        $result = $this->controller->createMatch($request, $this->responseFactory->createResponse());
        $this->assertSame($expectedStatus, $result->getStatusCode());
    }

    public static function errorCodes(): array
    {
        return [
            [MatchCreationException::STORY_NOT_FOUND, 404],
            [MatchCreationException::DIFFICULTY_NOT_FOUND, 404],
            [MatchCreationException::USER_NOT_FOUND, 404],
            [MatchCreationException::USER_BANNED, 403],
            [MatchCreationException::MAINTENANCE_MODE, 503],
            [MatchCreationException::STORY_HAS_NO_LOCATIONS, 400],
            [MatchCreationException::INVALID_INPUT, 400],
        ];
    }

    public function testCreateMatchUnknownErrorCodeFallsBackTo400(): void
    {
        $this->commandPort->method('createMatch')
            ->willThrowException(new MatchCreationException('UNKNOWN', 'msg'));
        $request = $this->authedRequest('POST', '/api/matches', [
            'storyUuid' => 's', 'difficultyUuid' => 'd'
        ]);
        $result = $this->controller->createMatch($request, $this->responseFactory->createResponse());
        $this->assertSame(400, $result->getStatusCode());
    }

    public function testListMatchesUnauthenticated(): void
    {
        $request = $this->requestFactory->createServerRequest('GET', '/api/matches');
        $result = $this->controller->listMatches($request, $this->responseFactory->createResponse());
        $this->assertSame(401, $result->getStatusCode());
    }

    public function testListMatchesReturnsArray(): void
    {
        $this->queryPort->method('listUserMatches')->willReturn([$this->summary()]);
        $request = $this->authedRequest('GET', '/api/matches');
        $result = $this->controller->listMatches($request, $this->responseFactory->createResponse());
        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertCount(1, $body);
    }

    public function testListAllMatchesReturnsArray(): void
    {
        $this->queryPort->method('listAllMatches')->willReturn([$this->summary()]);
        $request = $this->requestFactory->createServerRequest('GET', '/api/admin/matches');
        $result = $this->controller->listAllMatches($request, $this->responseFactory->createResponse());
        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertCount(1, $body);
        $this->assertSame('match-uuid', $body[0]['uuid']);
    }

    public function testListAllMatchesEmpty(): void
    {
        $this->queryPort->method('listAllMatches')->willReturn([]);
        $request = $this->requestFactory->createServerRequest('GET', '/api/admin/matches');
        $result = $this->controller->listAllMatches($request, $this->responseFactory->createResponse());
        $this->assertSame(200, $result->getStatusCode());
        $this->assertSame([], json_decode((string)$result->getBody(), true));
    }

    public function testGetMatchInfoUnauthenticated(): void
    {
        $request = $this->requestFactory->createServerRequest('GET', '/api/match/abc/info');
        $result = $this->controller->getMatchInfo($request, $this->responseFactory->createResponse(), ['uuidMatch' => 'abc']);
        $this->assertSame(401, $result->getStatusCode());
    }

    public function testGetMatchInfoMissingUuid(): void
    {
        $request = $this->authedRequest('GET', '/api/match//info');
        $result = $this->controller->getMatchInfo($request, $this->responseFactory->createResponse(), []);
        $this->assertSame(400, $result->getStatusCode());
    }

    public function testGetMatchInfoNotFound(): void
    {
        $this->queryPort->method('getMatchInfo')->willReturn(null);
        $request = $this->authedRequest('GET', '/api/match/abc/info');
        $result = $this->controller->getMatchInfo($request, $this->responseFactory->createResponse(), ['uuidMatch' => 'abc']);
        $this->assertSame(404, $result->getStatusCode());
    }

    public function testGetMatchInfoSuccess(): void
    {
        $this->queryPort->method('getMatchInfo')->willReturn($this->detail());
        $request = $this->authedRequest('GET', '/api/match/abc/info');
        $result = $this->controller->getMatchInfo($request, $this->responseFactory->createResponse(), ['uuidMatch' => 'abc']);
        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('match-uuid', $body['match']['uuid']);
        $this->assertSame(10, $body['currentLocationId']);
        $this->assertCount(1, $body['locations']);
        $this->assertCount(1, $body['registry']);
    }
}
