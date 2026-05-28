<?php

declare(strict_types=1);

namespace Games\Paths\Adapter\Rest\Story;

use Games\Paths\Core\Port\Story\StoryCrudPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

/**
 * StoryCrudAdminController — REST controller for Step 17 admin CRUD endpoints.
 */
class StoryCrudAdminController
{
    private StoryCrudPort $crudPort;

    public function __construct(StoryCrudPort $crudPort)
    {
        $this->crudPort = $crudPort;
    }

    // POST /api/admin/stories
    public function createStory(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }
        $data = $request->getParsedBody();
        if (empty($data)) {
            return $this->jsonError($response, 400, 'EMPTY_DATA', 'Request body required');
        }
        $result = $this->crudPort->createStory($data);
        if ($result === null) {
            return $this->jsonError($response, 400, 'INVALID_DATA', 'Could not create story');
        }
        $response->getBody()->write(json_encode($result));
        return $response->withStatus(201)->withHeader('Content-Type', 'application/json');
    }

    // GET /api/admin/stories/{uuidStory}
    public function getStory(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }
        $result = $this->crudPort->getStory($args['uuidStory']);
        if ($result === null) {
            return $this->jsonError($response, 404, 'STORY_NOT_FOUND', 'No story: ' . $args['uuidStory']);
        }
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }

    // PUT /api/admin/stories/{uuidStory}
    public function updateStory(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }
        $data = $request->getParsedBody();
        if (empty($data)) {
            return $this->jsonError($response, 400, 'EMPTY_DATA', 'Request body required');
        }
        $result = $this->crudPort->updateStory($args['uuidStory'], $data);
        if ($result === null) {
            return $this->jsonError($response, 404, 'STORY_NOT_FOUND', 'No story: ' . $args['uuidStory']);
        }
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }

    // GET /api/admin/stories/{uuidStory}/{entityType}
    public function listEntities(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }
        $result = $this->crudPort->listEntities($args['uuidStory'], $args['entityType']);
        if ($result === null) {
            return $this->jsonError($response, 404, 'STORY_NOT_FOUND', 'No story: ' . $args['uuidStory']);
        }
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }

    // POST /api/admin/stories/{uuidStory}/{entityType}
    public function createEntity(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }
        $data = $request->getParsedBody();
        if (empty($data)) {
            return $this->jsonError($response, 400, 'EMPTY_DATA', 'Request body required');
        }
        $result = $this->crudPort->createEntity($args['uuidStory'], $args['entityType'], $data);
        if ($result === null) {
            return $this->jsonError($response, 404, 'STORY_NOT_FOUND', 'No story: ' . $args['uuidStory']);
        }
        $response->getBody()->write(json_encode($result));
        return $response->withStatus(201)->withHeader('Content-Type', 'application/json');
    }

    // GET /api/admin/stories/{uuidStory}/{entityType}/{entityUuid}
    public function getEntity(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }
        $result = $this->crudPort->getEntity($args['uuidStory'], $args['entityType'], $args['entityUuid']);
        if ($result === null) {
            return $this->jsonError($response, 404, 'ENTITY_NOT_FOUND', 'Not found: ' . $args['entityUuid']);
        }
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }

    // PUT /api/admin/stories/{uuidStory}/{entityType}/{entityUuid}
    public function updateEntity(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }
        $data = $request->getParsedBody();
        if (empty($data)) {
            return $this->jsonError($response, 400, 'EMPTY_DATA', 'Request body required');
        }
        $result = $this->crudPort->updateEntity($args['uuidStory'], $args['entityType'], $args['entityUuid'], $data);
        if ($result === null) {
            return $this->jsonError($response, 404, 'ENTITY_NOT_FOUND', 'Not found: ' . $args['entityUuid']);
        }
        $response->getBody()->write(json_encode($result));
        return $response->withHeader('Content-Type', 'application/json');
    }

    // DELETE /api/admin/stories/{uuidStory}/{entityType}/{entityUuid}
    public function deleteEntity(Request $request, Response $response, array $args): Response
    {
        if (!$this->isAdmin($request)) {
            return $this->forbidden($response);
        }
        $deleted = $this->crudPort->deleteEntity($args['uuidStory'], $args['entityType'], $args['entityUuid']);
        if (!$deleted) {
            return $this->jsonError($response, 404, 'ENTITY_NOT_FOUND', 'Not found: ' . $args['entityUuid']);
        }
        $response->getBody()->write(json_encode([
            'status' => 'DELETED',
            'uuid' => $args['entityUuid'],
            'entityType' => $args['entityType'],
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
            'message' => 'Insufficient permissions (ADMIN role required)',
        ]));
        return $response->withStatus(403)->withHeader('Content-Type', 'application/json');
    }

    private function jsonError(Response $response, int $status, string $error, string $message): Response
    {
        $response->getBody()->write(json_encode([
            'error' => $error,
            'message' => $message,
        ]));
        return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
    }
}
