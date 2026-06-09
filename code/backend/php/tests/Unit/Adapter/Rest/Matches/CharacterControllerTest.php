<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest\Matches;

use Games\Paths\Adapter\Rest\Matches\CharacterController;
use Games\Paths\Core\Domain\Matches\CharacterInstanceInfo;
use Games\Paths\Core\Domain\Matches\CharacterJoinException;
use Games\Paths\Core\Port\Matches\CharacterCommandPort;
use Games\Paths\Core\Port\Matches\CharacterQueryPort;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class CharacterControllerTest extends TestCase
{
    private $commandPort;
    private $queryPort;
    private CharacterController $controller;
    private ResponseFactory $responseFactory;
    private ServerRequestFactory $requestFactory;

    protected function setUp(): void
    {
        $this->commandPort = $this->createMock(CharacterCommandPort::class);
        $this->queryPort = $this->createMock(CharacterQueryPort::class);
        $this->controller = new CharacterController($this->commandPort, $this->queryPort);
        $this->responseFactory = new ResponseFactory();
        $this->requestFactory = new ServerRequestFactory();
    }

    private function info(): CharacterInstanceInfo
    {
        return new CharacterInstanceInfo(
            uuid: 'char-uuid', matchUuid: 'match-uuid', userUuid: 'user-uuid',
            characterTemplateUuid: 'tpl', classUuid: 'cls',
            dexterity: 19, intelligence: 18, constitution: 19, energy: 127, life: 137, sad: 0,
            idLocation: 90001, locationUuid: 'loc', locationName: 'location-90001',
            isSleeping: 0, isComa: 0, traitUuids: ['t1'], food: 0, magic: 0, coin: 0
        );
    }

    private function authed(string $method, string $path, array $body = null)
    {
        $req = $this->requestFactory->createServerRequest($method, $path)
            ->withAttribute('userUuid', 'user-uuid');
        if ($body !== null) {
            $req = $req->withParsedBody($body);
        }
        return $req;
    }

    private function resp()
    {
        return $this->responseFactory->createResponse();
    }

    public function testJoinUnauthenticated(): void
    {
        $req = $this->requestFactory->createServerRequest('POST', '/api/matches/m1/join');
        $result = $this->controller->join($req, $this->resp(), ['uuidMatch' => 'm1']);
        $this->assertSame(401, $result->getStatusCode());
    }

    public function testJoinSuccess(): void
    {
        $this->commandPort->method('join')->willReturn($this->info());
        $result = $this->controller->join(
            $this->authed('POST', '/api/matches/m1/join', ['characterTemplateUuid' => 't']),
            $this->resp(), ['uuidMatch' => 'm1']
        );
        $this->assertSame(201, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('char-uuid', $body['uuid']);
        $this->assertSame(137, $body['life']);
    }

    public function testJoinEmptyBody(): void
    {
        $this->commandPort->method('join')->willReturn($this->info());
        $result = $this->controller->join(
            $this->authed('POST', '/api/matches/m1/join'), $this->resp(), ['uuidMatch' => 'm1']
        );
        $this->assertSame(201, $result->getStatusCode());
    }

    /**
     * @dataProvider errorCodes
     */
    public function testJoinErrorCodes(string $code, int $expected): void
    {
        $this->commandPort->method('join')->willThrowException(new CharacterJoinException($code, 'x'));
        $result = $this->controller->join(
            $this->authed('POST', '/api/matches/m1/join', []), $this->resp(), ['uuidMatch' => 'm1']
        );
        $this->assertSame($expected, $result->getStatusCode());
    }

    public static function errorCodes(): array
    {
        return [
            [CharacterJoinException::MATCH_NOT_FOUND, 404],
            [CharacterJoinException::TEMPLATE_NOT_FOUND, 404],
            [CharacterJoinException::CLASS_NOT_FOUND, 404],
            [CharacterJoinException::USER_NOT_FOUND, 404],
            [CharacterJoinException::USER_BANNED, 403],
            [CharacterJoinException::ALREADY_JOINED, 409],
            [CharacterJoinException::CLASS_NOT_COMPATIBLE, 409],
            [CharacterJoinException::MATCH_NOT_JOINABLE, 409],
            [CharacterJoinException::INVALID_INPUT, 400],
        ];
    }

    public function testPlayersUnauthenticated(): void
    {
        $req = $this->requestFactory->createServerRequest('GET', '/api/match/m1/players');
        $result = $this->controller->listPlayers($req, $this->resp(), ['uuidMatch' => 'm1']);
        $this->assertSame(401, $result->getStatusCode());
    }

    public function testPlayersOk(): void
    {
        $this->queryPort->method('listPlayers')->willReturn([$this->info()]);
        $result = $this->controller->listPlayers(
            $this->authed('GET', '/api/match/m1/players'), $this->resp(), ['uuidMatch' => 'm1']
        );
        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame('char-uuid', $body[0]['uuid']);
    }

    public function testPlayersNotFound(): void
    {
        $this->queryPort->method('listPlayers')->willReturn(null);
        $result = $this->controller->listPlayers(
            $this->authed('GET', '/api/match/m1/players'), $this->resp(), ['uuidMatch' => 'm1']
        );
        $this->assertSame(404, $result->getStatusCode());
    }

    public function testCharacterUnauthenticated(): void
    {
        $req = $this->requestFactory->createServerRequest('GET', '/api/match/m1/characters/c1');
        $result = $this->controller->getCharacter($req, $this->resp(), ['uuidMatch' => 'm1', 'uuidCharacter' => 'c1']);
        $this->assertSame(401, $result->getStatusCode());
    }

    public function testCharacterOk(): void
    {
        $this->queryPort->method('getCharacter')->willReturn($this->info());
        $result = $this->controller->getCharacter(
            $this->authed('GET', '/api/match/m1/characters/c1'), $this->resp(),
            ['uuidMatch' => 'm1', 'uuidCharacter' => 'c1']
        );
        $this->assertSame(200, $result->getStatusCode());
        $body = json_decode((string)$result->getBody(), true);
        $this->assertSame(['t1'], $body['traitUuids']);
    }

    public function testCharacterNotFound(): void
    {
        $this->queryPort->method('getCharacter')->willReturn(null);
        $result = $this->controller->getCharacter(
            $this->authed('GET', '/api/match/m1/characters/c1'), $this->resp(),
            ['uuidMatch' => 'm1', 'uuidCharacter' => 'c1']
        );
        $this->assertSame(404, $result->getStatusCode());
    }
}
