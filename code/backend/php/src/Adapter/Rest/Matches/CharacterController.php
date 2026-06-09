<?php

namespace Games\Paths\Adapter\Rest\Matches;

use Games\Paths\Core\Domain\Matches\CharacterJoinException;
use Games\Paths\Core\Domain\Matches\JoinMatchCommand;
use Games\Paths\Core\Port\Matches\CharacterCommandPort;
use Games\Paths\Core\Port\Matches\CharacterQueryPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * Step 21 — REST adapter for the character endpoints.
 */
class CharacterController
{
    private const STATUS_BY_CODE = [
        CharacterJoinException::INVALID_INPUT => 400,
        CharacterJoinException::MATCH_NOT_FOUND => 404,
        CharacterJoinException::TEMPLATE_NOT_FOUND => 404,
        CharacterJoinException::CLASS_NOT_FOUND => 404,
        CharacterJoinException::USER_NOT_FOUND => 404,
        CharacterJoinException::USER_BANNED => 403,
        CharacterJoinException::ALREADY_JOINED => 409,
        CharacterJoinException::CLASS_NOT_COMPATIBLE => 409,
        CharacterJoinException::MATCH_NOT_JOINABLE => 409,
    ];

    public function __construct(
        private readonly CharacterCommandPort $commandPort,
        private readonly CharacterQueryPort $queryPort
    ) {
    }

    public function join(Request $request, Response $response, array $args): Response
    {
        $userUuid = (string)($request->getAttribute('userUuid') ?? '');
        if ($userUuid === '') {
            return $this->error($response, 'UNAUTHENTICATED', 'User identity is missing', 401);
        }
        $matchUuid = (string)($args['uuidMatch'] ?? '');
        if ($matchUuid === '') {
            return $this->error($response, 'INVALID_INPUT', 'Match uuid is required', 400);
        }
        $body = (array)($request->getParsedBody() ?? []);
        $traitUuids = $body['traitUuids'] ?? [];
        $command = new JoinMatchCommand(
            matchUuid: $matchUuid,
            userUuid: $userUuid,
            characterTemplateUuid: $body['characterTemplateUuid'] ?? null,
            classUuid: $body['classUuid'] ?? null,
            traitUuids: is_array($traitUuids) ? $traitUuids : []
        );
        try {
            $created = $this->commandPort->join($command);
        } catch (CharacterJoinException $e) {
            $status = self::STATUS_BY_CODE[$e->getCodeId()] ?? 400;
            return $this->error($response, $e->getCodeId(), $e->getMessage(), $status);
        }
        $response->getBody()->write(json_encode($created->toArray()));
        return $response->withStatus(201)->withHeader('Content-Type', 'application/json');
    }

    public function listPlayers(Request $request, Response $response, array $args): Response
    {
        $userUuid = (string)($request->getAttribute('userUuid') ?? '');
        if ($userUuid === '') {
            return $this->error($response, 'UNAUTHENTICATED', 'User identity is missing', 401);
        }
        $matchUuid = (string)($args['uuidMatch'] ?? '');
        if ($matchUuid === '') {
            return $this->error($response, 'INVALID_INPUT', 'Match uuid is required', 400);
        }
        $players = $this->queryPort->listPlayers($matchUuid, $userUuid);
        if ($players === null) {
            return $this->error($response, 'MATCH_NOT_FOUND', 'Match not found or not accessible', 404);
        }
        $body = array_map(static fn($p) => $p->toSummaryArray(), $players);
        $response->getBody()->write(json_encode($body));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }

    public function getCharacter(Request $request, Response $response, array $args): Response
    {
        $userUuid = (string)($request->getAttribute('userUuid') ?? '');
        if ($userUuid === '') {
            return $this->error($response, 'UNAUTHENTICATED', 'User identity is missing', 401);
        }
        $matchUuid = (string)($args['uuidMatch'] ?? '');
        $characterUuid = (string)($args['uuidCharacter'] ?? '');
        if ($matchUuid === '' || $characterUuid === '') {
            return $this->error($response, 'INVALID_INPUT', 'Match uuid and character uuid are required', 400);
        }
        $character = $this->queryPort->getCharacter($matchUuid, $characterUuid, $userUuid);
        if ($character === null) {
            return $this->error($response, 'CHARACTER_NOT_FOUND', 'Character not found or not accessible', 404);
        }
        $response->getBody()->write(json_encode($character->toArray()));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }

    private function error(Response $response, string $code, string $message, int $status): Response
    {
        $response->getBody()->write(json_encode([
            'error' => $code,
            'message' => $message,
            'timestamp' => (int)(microtime(true) * 1000),
        ]));
        return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
    }
}
