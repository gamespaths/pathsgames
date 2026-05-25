<?php

namespace Games\Paths\Adapter\Rest\Matches;

use Games\Paths\Core\Domain\Matches\MatchCreateCommand;
use Games\Paths\Core\Domain\Matches\MatchCreationException;
use Games\Paths\Core\Domain\Matches\MatchStatuses;
use Games\Paths\Core\Port\Matches\MatchCommandPort;
use Games\Paths\Core\Port\Matches\MatchQueryPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class MatchController
{
    private const STATUS_BY_CODE = [
        MatchCreationException::INVALID_INPUT => 400,
        MatchCreationException::STORY_HAS_NO_LOCATIONS => 400,
        MatchCreationException::TURNSTILE_VALIDATION_FAILED => 400,
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

        $traitUuids = $body['traitUuids'] ?? [];
        $serverParams = $request->getServerParams();
        $remoteIp = $serverParams['REMOTE_ADDR'] ?? null;
        $command = new MatchCreateCommand(
            userUuid: $userUuid,
            storyUuid: $storyUuid,
            difficultyUuid: $difficultyUuid,
            name: $body['name'] ?? null,
            characterTemplateUuid: $body['characterTemplateUuid'] ?? null,
            classUuid: $body['classUuid'] ?? null,
            traitUuids: is_array($traitUuids) ? $traitUuids : [],
            singlePlayer: isset($body['singlePlayer']) ? (int)$body['singlePlayer'] : null,
            turnstileToken: $body['turnstileToken'] ?? null,
            remoteIp: $remoteIp
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

    public function listAllMatches(Request $request, Response $response): Response
    {
        // The admin role is enforced by JwtAuthenticationMiddleware for /api/admin/ paths.
        $matches = $this->queryPort->listAllMatches();
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

    /**
     * GET /api/admin/matches/statuses — valid match statuses, each flagged
     * "terminal" when a match in that status is stopped (deletable).
     */
    public function listMatchStatuses(Request $request, Response $response): Response
    {
        $body = array_map(
            static fn(string $s): array => ['value' => $s, 'terminal' => MatchStatuses::isTerminal($s)],
            MatchStatuses::ALL
        );
        return $this->ok($response, $body);
    }

    /**
     * GET /api/admin/matches/{uuidMatch}/info — full match detail for the
     * admin console, without the per-user ownership check enforced by
     * GET /api/match/{uuidMatch}/info.
     */
    public function getAdminMatchInfo(Request $request, Response $response, array $args): Response
    {
        $matchUuid = (string)($args['uuidMatch'] ?? '');
        if ($matchUuid === '') {
            return $this->error($response, 'INVALID_INPUT', 'Match uuid is required', 400);
        }
        $detail = $this->queryPort->getMatchInfoForAdmin($matchUuid);
        if ($detail === null) {
            return $this->error($response, 'MATCH_NOT_FOUND', 'Match not found: ' . $matchUuid, 404);
        }
        $response->getBody()->write(json_encode($detail->toArray()));
        return $response->withStatus(200)->withHeader('Content-Type', 'application/json');
    }

    /** PUT /api/admin/matches/{uuidMatch} — admin update of status and/or name. */
    public function updateMatch(Request $request, Response $response, array $args): Response
    {
        $uuid = (string)($args['uuidMatch'] ?? '');
        $body = (array)($request->getParsedBody() ?? []);
        $status = array_key_exists('status', $body) ? $body['status'] : null;
        $name = array_key_exists('name', $body) ? $body['name'] : null;
        if ($status === null && $name === null) {
            return $this->error($response, 'INVALID_INPUT',
                'At least one of status or name must be provided', 400);
        }
        return $this->applyUpdate($response, $uuid, $status, $name);
    }

    /** POST /api/admin/matches/{uuidMatch}/stop — sets the match status to ENDED. */
    public function stopMatch(Request $request, Response $response, array $args): Response
    {
        return $this->applyUpdate($response, (string)($args['uuidMatch'] ?? ''), MatchStatuses::ENDED, null);
    }

    /** POST /api/admin/matches/{uuidMatch}/pause — sets the match status to PAUSED. */
    public function pauseMatch(Request $request, Response $response, array $args): Response
    {
        return $this->applyUpdate($response, (string)($args['uuidMatch'] ?? ''), MatchStatuses::PAUSED, null);
    }

    /** POST /api/admin/matches/{uuidMatch}/resume — sets the match status to RUNNING. */
    public function resumeMatch(Request $request, Response $response, array $args): Response
    {
        return $this->applyUpdate($response, (string)($args['uuidMatch'] ?? ''), MatchStatuses::RUNNING, null);
    }

    /**
     * DELETE /api/admin/matches/{uuidMatch} — deletes a match. Only matches in
     * a terminal status (ENDED / GAMEOVER) may be deleted.
     */
    public function deleteMatch(Request $request, Response $response, array $args): Response
    {
        $uuid = (string)($args['uuidMatch'] ?? '');
        $outcome = $this->commandPort->deleteMatch($uuid);
        if ($outcome === 'DELETED') {
            return $this->ok($response, ['status' => 'DELETED', 'uuid' => $uuid]);
        }
        if ($outcome === 'NOT_STOPPED') {
            return $this->error($response, 'MATCH_NOT_STOPPED',
                'Only stopped matches (ENDED or GAMEOVER) can be deleted', 409);
        }
        return $this->error($response, 'MATCH_NOT_FOUND', 'Match not found: ' . $uuid, 404);
    }

    private function applyUpdate(Response $response, string $uuid, ?string $status, ?string $name): Response
    {
        $outcome = $this->commandPort->updateMatch($uuid, $status, $name);
        if ($outcome === 'UPDATED') {
            return $this->ok($response, ['status' => 'UPDATED', 'uuid' => $uuid]);
        }
        if ($outcome === 'INVALID_STATUS') {
            return $this->error($response, 'INVALID_STATUS',
                'status must be one of ' . implode(', ', MatchStatuses::ALL), 400);
        }
        return $this->error($response, 'MATCH_NOT_FOUND', 'Match not found: ' . $uuid, 404);
    }

    private function ok(Response $response, array $data): Response
    {
        $response->getBody()->write(json_encode($data));
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
