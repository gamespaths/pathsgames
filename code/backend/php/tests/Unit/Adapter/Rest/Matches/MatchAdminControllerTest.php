<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest\Matches;

use Games\Paths\Adapter\Rest\Matches\MatchAdminController;
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

/**
 * Tests for the admin-only match endpoints extracted into MatchAdminController.
 */
class MatchAdminControllerTest extends TestCase
{
    private $commandPort;
    private $queryPort;
    private MatchAdminController $controller;
    private ResponseFactory $responseFactory;
    private ServerRequestFactory $requestFactory;

    protected function setUp(): void
    {
        $this->commandPort = $this->createMock(MatchCommandPort::class);
        $this->queryPort = $this->createMock(MatchQueryPort::class);
        $this->controller = new MatchAdminController($this->commandPort, $this->queryPort);
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

    private function args(string $uuid = 'm1'): array
    {
        return ['uuidMatch' => $uuid];
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

    public function testListMatchStatuses(): void
    {
        $result = $this->controller->listMatchStatuses(
            $this->requestFactory->createServerRequest('GET', '/api/admin/matches/statuses'),
            $this->responseFactory->createResponse()
        );
        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame(['value' => 'CREATED', 'terminal' => false], $body[0]);
        $this->assertContains(['value' => 'ENDED', 'terminal' => true], $body);
    }

    public function testUpdateMatchReturns200(): void
    {
        $this->commandPort->method('updateMatch')->with('m1', 'ENDED', 'x')->willReturn('UPDATED');
        $request = $this->requestFactory->createServerRequest('PUT', '/api/admin/matches/m1')
            ->withParsedBody(['status' => 'ENDED', 'name' => 'x']);
        $result = $this->controller->updateMatch($request, $this->responseFactory->createResponse(), $this->args());
        $this->assertSame(200, $result->getStatusCode());
        $this->assertSame('UPDATED', json_decode((string)$result->getBody(), true)['status']);
    }

    public function testUpdateMatchEmptyBodyReturns400(): void
    {
        $request = $this->requestFactory->createServerRequest('PUT', '/api/admin/matches/m1')
            ->withParsedBody([]);
        $result = $this->controller->updateMatch($request, $this->responseFactory->createResponse(), $this->args());
        $this->assertSame(400, $result->getStatusCode());
        $this->assertSame('INVALID_INPUT', json_decode((string)$result->getBody(), true)['error']);
    }

    public function testUpdateMatchInvalidStatusReturns400(): void
    {
        $this->commandPort->method('updateMatch')->willReturn('INVALID_STATUS');
        $request = $this->requestFactory->createServerRequest('PUT', '/api/admin/matches/m1')
            ->withParsedBody(['status' => 'BOGUS']);
        $result = $this->controller->updateMatch($request, $this->responseFactory->createResponse(), $this->args());
        $this->assertSame(400, $result->getStatusCode());
        $this->assertSame('INVALID_STATUS', json_decode((string)$result->getBody(), true)['error']);
    }

    public function testUpdateMatchNotFoundReturns404(): void
    {
        $this->commandPort->method('updateMatch')->willReturn('NOT_FOUND');
        $request = $this->requestFactory->createServerRequest('PUT', '/api/admin/matches/m1')
            ->withParsedBody(['name' => 'x']);
        $result = $this->controller->updateMatch($request, $this->responseFactory->createResponse(), $this->args());
        $this->assertSame(404, $result->getStatusCode());
    }

    public function testStopMatchSetsEnded(): void
    {
        $this->commandPort->expects($this->once())->method('updateMatch')
            ->with('m1', 'ENDED', null)->willReturn('UPDATED');
        $result = $this->controller->stopMatch(
            $this->requestFactory->createServerRequest('POST', '/api/admin/matches/m1/stop'),
            $this->responseFactory->createResponse(),
            $this->args()
        );
        $this->assertSame(200, $result->getStatusCode());
    }

    public function testPauseAndResume(): void
    {
        $this->commandPort->method('updateMatch')->willReturn('UPDATED');
        $pause = $this->controller->pauseMatch(
            $this->requestFactory->createServerRequest('POST', '/api/admin/matches/m1/pause'),
            $this->responseFactory->createResponse(),
            $this->args()
        );
        $resume = $this->controller->resumeMatch(
            $this->requestFactory->createServerRequest('POST', '/api/admin/matches/m1/resume'),
            $this->responseFactory->createResponse(),
            $this->args()
        );
        $this->assertSame(200, $pause->getStatusCode());
        $this->assertSame(200, $resume->getStatusCode());
    }

    public function testDeleteMatchReturns200(): void
    {
        $this->commandPort->method('deleteMatch')->with('m1')->willReturn('DELETED');
        $result = $this->controller->deleteMatch(
            $this->requestFactory->createServerRequest('DELETE', '/api/admin/matches/m1'),
            $this->responseFactory->createResponse(),
            $this->args()
        );
        $this->assertSame(200, $result->getStatusCode());
        $this->assertSame('DELETED', json_decode((string)$result->getBody(), true)['status']);
    }

    public function testDeleteMatchNotStoppedReturns409(): void
    {
        $this->commandPort->method('deleteMatch')->willReturn('NOT_STOPPED');
        $result = $this->controller->deleteMatch(
            $this->requestFactory->createServerRequest('DELETE', '/api/admin/matches/m1'),
            $this->responseFactory->createResponse(),
            $this->args()
        );
        $this->assertSame(409, $result->getStatusCode());
        $this->assertSame('MATCH_NOT_STOPPED', json_decode((string)$result->getBody(), true)['error']);
    }

    public function testDeleteMatchNotFoundReturns404(): void
    {
        $this->commandPort->method('deleteMatch')->willReturn('NOT_FOUND');
        $result = $this->controller->deleteMatch(
            $this->requestFactory->createServerRequest('DELETE', '/api/admin/matches/m1'),
            $this->responseFactory->createResponse(),
            $this->args()
        );
        $this->assertSame(404, $result->getStatusCode());
    }

    public function testGetAdminMatchInfoReturns200(): void
    {
        $this->queryPort->method('getMatchInfoForAdmin')->with('m1')->willReturn($this->detail());
        $result = $this->controller->getAdminMatchInfo(
            $this->requestFactory->createServerRequest('GET', '/api/admin/matches/m1/info'),
            $this->responseFactory->createResponse(),
            $this->args()
        );
        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('match-uuid', $body['match']['uuid']);
    }

    public function testGetAdminMatchInfoReturns404(): void
    {
        $this->queryPort->method('getMatchInfoForAdmin')->willReturn(null);
        $result = $this->controller->getAdminMatchInfo(
            $this->requestFactory->createServerRequest('GET', '/api/admin/matches/m1/info'),
            $this->responseFactory->createResponse(),
            $this->args()
        );
        $this->assertSame(404, $result->getStatusCode());
        $this->assertSame('MATCH_NOT_FOUND', json_decode((string)$result->getBody(), true)['error']);
    }

    public function testGetAdminMatchInfoMissingUuidReturns400(): void
    {
        $result = $this->controller->getAdminMatchInfo(
            $this->requestFactory->createServerRequest('GET', '/api/admin/matches//info'),
            $this->responseFactory->createResponse(),
            []
        );
        $this->assertSame(400, $result->getStatusCode());
        $this->assertSame('INVALID_INPUT', json_decode((string)$result->getBody(), true)['error']);
    }
}
