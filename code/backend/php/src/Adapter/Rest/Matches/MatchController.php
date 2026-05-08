<?php

namespace Games\Paths\Adapter\Rest\Matches;

use Games\Paths\Core\Domain\Matches\MatchCreateCommand;
use Games\Paths\Core\Domain\Matches\MatchCreationException;
use Games\Paths\Core\Port\Matches\MatchCommandPort;
use Games\Paths\Core\Port\Matches\MatchQueryPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class MatchController
{
    private const STATUS_BY_CODE = [
        MatchCreationException::INVALID_INPUT => 400,
        MatchCreationException::STORY_HAS_NO_LOCATIONS => 400,
        MatchCreationException::STORY_NOT_FOUND => 404,
        MatchCreationException::DIFFICULTY_NOT_FOUND => 404,
        MatchCreationException::USER_NOT_FOUND => 404,
        MatchCreationException::USER_BANNED => 403,
        MatchCreationException::MAINTENANCE_MODE => 503,
    ];

    public function __construct(
        private readonly MatchCommandPort $commandPort,
        private readonly MatchQueryPort $queryPort
    ) {
    }

    public function createMatch(Request $request, Response $response): Response
    {
        $userUuid = (string)($request->getAttribute('userUuid') ?? '');
        if ($userUuid === '') {
            return $this->error($response, 'UNAUTHENTICATED', 'User identity is missing', 401);
        }
        $body = (array)($request->getParsedBody() ?? []);
        $storyUuid = (string)($body['storyUuid'] ?? '');
        $difficultyUuid = (string)($body['difficultyUuid'] ?? '');
        if ($storyUuid === '' || $difficultyUuid === '') {
            return $this->error($response, 'INVALID_INPUT', 'storyUuid and difficultyUuid are required', 400);
        }

        $command = new MatchCreateCommand(
            userUuid: $userUuid,
            storyUuid: $storyUuid,
            difficultyUuid: $difficultyUuid,
            name: $body['name'] ?? null,
            characterTemplateUuid: $body['characterTemplateUuid'] ?? null
        );

        try {
            $summary = $this->commandPort->createMatch($command);
        } catch (MatchCreationException $e) {
            $status = self::STATUS_BY_CODE[$e->getCodeId()] ?? 400;
            return $this->error($response, $e->getCodeId(), $e->getMessage(), $status);
        }

        $response->getBody()->write(json_encode($summary->toArray()));
        return $response->withStatus(201)->withHeader('Content-Type', 'application/json');
    }

    public function listMatches(Request $request, Response $response): Response
    {
        $userUuid = (string)($request->getAttribute('userUuid') ?? '');
        if ($userUuid === '') {
            return $this->error($response, 'UNAUTHENTICATED', 'User identity is missing', 401);
        }
        $matches = $this->queryPort->listUserMatches($userUuid);
        $body = array_map(fn($m) => $m->toArray(), $matches);
        $response->getBody()->write(json_encode($body));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }

    public function getMatchInfo(Request $request, Response $response, array $args): Response
    {
        $userUuid = (string)($request->getAttribute('userUuid') ?? '');
        if ($userUuid === '') {
            return $this->error($response, 'UNAUTHENTICATED', 'User identity is missing', 401);
        }
        $matchUuid = (string)($args['uuidMatch'] ?? '');
        if ($matchUuid === '') {
            return $this->error($response, 'INVALID_INPUT', 'Match uuid is required', 400);
        }
        $detail = $this->queryPort->getMatchInfo($matchUuid, $userUuid);
        if ($detail === null) {
            return $this->error($response, 'MATCH_NOT_FOUND', 'Match not found or not accessible', 404);
        }
        $response->getBody()->write(json_encode($detail->toArray()));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }

    private function error(Response $response, string $code, string $message, int $status): Response
    {
        $body = json_encode([
            'error' => $code,
            'message' => $message,
            'timestamp' => (int)(microtime(true) * 1000),
        ]);
        $response->getBody()->write($body);
        return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
    }
}
