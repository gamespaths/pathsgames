<?php

declare(strict_types=1);

namespace Games\Paths\Adapter\Rest\Story;

use Games\Paths\Core\Domain\Story\StoryValidationException;
use Games\Paths\Core\Port\Story\StoryImportPort;
use Games\Paths\Core\Port\Story\StoryQueryPort;
use Games\Paths\Core\Service\Story\StoryValidatorService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use InvalidArgumentException;

class StoryAdminController
{
    private StoryQueryPort $queryPort;
    private StoryImportPort $importPort;
    private ?StoryValidatorService $validator;

    public function __construct(StoryQueryPort $queryPort, StoryImportPort $importPort, ?StoryValidatorService $validator = null)
    {
        $this->queryPort = $queryPort;
        $this->importPort = $importPort;
        $this->validator = $validator;
    }

    public function listAllStories(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }

        $lang = $request->getQueryParams()['lang'] ?? 'en';
        $stories = $this->queryPort->listAllStories($lang);

        $response->getBody()->write(json_encode($stories));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function importStory(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }

        $data = $request->getParsedBody();
        if (empty($data)) {
            $response->getBody()->write(json_encode([
                'error' => 'EMPTY_IMPORT_DATA',
                'message' => 'Request body must contain story data'
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }

        try {
            $result = $this->importPort->importStory($data);
            $response->getBody()->write(json_encode($result));
            return $response->withStatus(201)->withHeader('Content-Type', 'application/json');
        } catch (StoryValidationException $e) {
            $report = $e->getReport();
            $response->getBody()->write(json_encode([
                'error' => 'INVALID_STORY',
                'message' => $report->summary(),
                'errors' => array_map(fn ($err) => $err->toArray(), $report->getErrors()),
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        } catch (InvalidArgumentException $e) {
            $response->getBody()->write(json_encode([
                'error' => 'INVALID_IMPORT_DATA',
                'message' => $e->getMessage()
            ]));
            return $response->withStatus(400)->withHeader('Content-Type', 'application/json');
        }
    }

    public function validateStory(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }

        $uuid = $args['uuid'];
        if ($this->validator === null) {
            $response->getBody()->write(json_encode(['valid' => true, 'count' => 0, 'errors' => []]));
            return $response->withHeader('Content-Type', 'application/json');
        }
        $report = $this->validator->validateStoryByUuid($uuid);
        if ($report === null) {
            $response->getBody()->write(json_encode([
                'error' => 'STORY_NOT_FOUND',
                'message' => 'No story found with UUID: ' . $uuid
            ]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }
        $response->getBody()->write(json_encode($report->toArray()));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function deleteStory(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }

        $uuid = $args['uuid'];
        $deleted = $this->importPort->deleteStory($uuid);

        if (!$deleted) {
            $response->getBody()->write(json_encode([
                'error' => 'STORY_NOT_FOUND',
                'message' => 'No story found with UUID: ' . $uuid
            ]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode([
            'status' => 'DELETED',
            'uuid' => $uuid
        ]));
        return $response->withHeader('Content-Type', 'application/json');
    }

    private function isAdmin(Request $request): bool
    {
        $role = $request->getAttribute('role');
        return $role === 'ADMIN';
    }

    private function forbidden(Response $response): Response
    {
        $response->getBody()->write(json_encode([
            'error' => 'FORBIDDEN',
            'message' => 'Insufficient permissions (ADMIN role required)'
        ]));
        return $response->withStatus(403)->withHeader('Content-Type', 'application/json');
    }
}
