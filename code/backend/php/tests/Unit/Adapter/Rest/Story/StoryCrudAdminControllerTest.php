<?php

declare(strict_types=1);

namespace Tests\Unit\Adapter\Rest\Story;

use PHPUnit\Framework\TestCase;
use Games\Paths\Adapter\Rest\Story\StoryCrudAdminController;
use Games\Paths\Core\Port\Story\StoryCrudPort;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Factory\ResponseFactory;

/**
 * Tests for StoryCrudAdminController — Step 17.
 */
class StoryCrudAdminControllerTest extends TestCase
{
    private $crudPort;
    private StoryCrudAdminController $controller;

    protected function setUp(): void
    {
        $this->crudPort = $this->createMock(StoryCrudPort::class);
        $this->controller = new StoryCrudAdminController($this->crudPort);
    }

    private function createAdminRequest(string $method, string $uri, ?array $body = null): \Psr\Http\Message\ServerRequestInterface
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, $uri);
        $request = $request->withAttribute('role', 'ADMIN');
        if ($body !== null) {
            $request = $request->withParsedBody($body);
        }
        return $request;
    }

    private function createGuestRequest(string $method, string $uri): \Psr\Http\Message\ServerRequestInterface
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, $uri);
        $request = $request->withAttribute('role', 'GUEST');
        return $request;
    }

    private function createResponse(): \Psr\Http\Message\ResponseInterface
    {
        return (new ResponseFactory())->createResponse();
    }

    // === Auth guard ===

    public function testListEntities_guestForbidden(): void
    {
        $req = $this->createGuestRequest('GET', '/api/admin/stories/s1/locations');
        $resp = $this->controller->listEntities($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations']);
        $this->assertEquals(403, $resp->getStatusCode());
    }

    public function testCreateStory_guestForbidden(): void
    {
        $req = $this->createGuestRequest('POST', '/api/admin/stories');
        $resp = $this->controller->createStory($req, $this->createResponse(), []);
        $this->assertEquals(403, $resp->getStatusCode());
    }

    // === List entities ===

    public function testListEntities_success(): void
    {
        $this->crudPort->method('listEntities')->willReturn([['uuid' => 'e1']]);
        $req = $this->createAdminRequest('GET', '/api/admin/stories/s1/locations');
        $resp = $this->controller->listEntities($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations']);
        $this->assertEquals(200, $resp->getStatusCode());
    }

    public function testListEntities_storyNotFound(): void
    {
        $this->crudPort->method('listEntities')->willReturn(null);
        $req = $this->createAdminRequest('GET', '/api/admin/stories/bad/locations');
        $resp = $this->controller->listEntities($req, $this->createResponse(), ['uuidStory' => 'bad', 'entityType' => 'locations']);
        $this->assertEquals(404, $resp->getStatusCode());
    }

    // === Get entity ===

    public function testGetEntity_success(): void
    {
        $this->crudPort->method('getEntity')->willReturn(['uuid' => 'e1']);
        $req = $this->createAdminRequest('GET', '/api/admin/stories/s1/locations/e1');
        $resp = $this->controller->getEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'e1']);
        $this->assertEquals(200, $resp->getStatusCode());
    }

    public function testGetEntity_notFound(): void
    {
        $this->crudPort->method('getEntity')->willReturn(null);
        $req = $this->createAdminRequest('GET', '/api/admin/stories/s1/locations/bad');
        $resp = $this->controller->getEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'bad']);
        $this->assertEquals(404, $resp->getStatusCode());
    }

    // === Create entity ===

    public function testCreateEntity_success(): void
    {
        $this->crudPort->method('createEntity')->willReturn(['uuid' => 'new']);
        $req = $this->createAdminRequest('POST', '/api/admin/stories/s1/locations', ['isSafe' => 1]);
        $resp = $this->controller->createEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations']);
        $this->assertEquals(201, $resp->getStatusCode());
    }

    public function testCreateEntity_emptyBody(): void
    {
        $req = $this->createAdminRequest('POST', '/api/admin/stories/s1/locations');
        $resp = $this->controller->createEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations']);
        $this->assertEquals(400, $resp->getStatusCode());
    }

    public function testCreateEntity_storyNotFound(): void
    {
        $this->crudPort->method('createEntity')->willReturn(null);
        $req = $this->createAdminRequest('POST', '/api/admin/stories/bad/locations', ['k' => 'v']);
        $resp = $this->controller->createEntity($req, $this->createResponse(), ['uuidStory' => 'bad', 'entityType' => 'locations']);
        $this->assertEquals(404, $resp->getStatusCode());
    }

    // === Update entity ===

    public function testUpdateEntity_success(): void
    {
        $this->crudPort->method('updateEntity')->willReturn(['uuid' => 'e1']);
        $req = $this->createAdminRequest('PUT', '/api/admin/stories/s1/locations/e1', ['isSafe' => 0]);
        $resp = $this->controller->updateEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'e1']);
        $this->assertEquals(200, $resp->getStatusCode());
    }

    public function testUpdateEntity_notFound(): void
    {
        $this->crudPort->method('updateEntity')->willReturn(null);
        $req = $this->createAdminRequest('PUT', '/api/admin/stories/s1/locations/bad', ['k' => 'v']);
        $resp = $this->controller->updateEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'bad']);
        $this->assertEquals(404, $resp->getStatusCode());
    }

    public function testUpdateEntity_emptyBody(): void
    {
        $req = $this->createAdminRequest('PUT', '/api/admin/stories/s1/locations/e1');
        $resp = $this->controller->updateEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'e1']);
        $this->assertEquals(400, $resp->getStatusCode());
    }

    // === Delete entity ===

    public function testDeleteEntity_success(): void
    {
        $this->crudPort->method('deleteEntity')->willReturn(true);
        $req = $this->createAdminRequest('DELETE', '/api/admin/stories/s1/locations/e1');
        $resp = $this->controller->deleteEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'e1']);
        $this->assertEquals(200, $resp->getStatusCode());
    }

    public function testDeleteEntity_notFound(): void
    {
        $this->crudPort->method('deleteEntity')->willReturn(false);
        $req = $this->createAdminRequest('DELETE', '/api/admin/stories/s1/locations/bad');
        $resp = $this->controller->deleteEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'bad']);
        $this->assertEquals(404, $resp->getStatusCode());
    }

    // === Create story ===

    public function testCreateStory_success(): void
    {
        $this->crudPort->method('createStory')->willReturn(['uuid' => 'new-s']);
        $req = $this->createAdminRequest('POST', '/api/admin/stories', ['author' => 'Test']);
        $resp = $this->controller->createStory($req, $this->createResponse(), []);
        $this->assertEquals(201, $resp->getStatusCode());
    }

    public function testCreateStory_emptyBody(): void
    {
        $req = $this->createAdminRequest('POST', '/api/admin/stories');
        $resp = $this->controller->createStory($req, $this->createResponse(), []);
        $this->assertEquals(400, $resp->getStatusCode());
    }

    public function testCreateStory_invalidData(): void
    {
        $this->crudPort->method('createStory')->willReturn(null);
        $req = $this->createAdminRequest('POST', '/api/admin/stories', ['author' => 'Test']);
        $resp = $this->controller->createStory($req, $this->createResponse(), []);
        $this->assertEquals(400, $resp->getStatusCode());
    }

    // === Update story ===

    public function testUpdateStory_success(): void
    {
        $this->crudPort->method('updateStory')->willReturn(['uuid' => 's1']);
        $req = $this->createAdminRequest('PUT', '/api/admin/stories/s1', ['author' => 'Updated']);
        $resp = $this->controller->updateStory($req, $this->createResponse(), ['uuidStory' => 's1']);
        $this->assertEquals(200, $resp->getStatusCode());
    }

    public function testUpdateStory_notFound(): void
    {
        $this->crudPort->method('updateStory')->willReturn(null);
        $req = $this->createAdminRequest('PUT', '/api/admin/stories/bad', ['author' => 'X']);
        $resp = $this->controller->updateStory($req, $this->createResponse(), ['uuidStory' => 'bad']);
        $this->assertEquals(404, $resp->getStatusCode());
    }

    public function testUpdateStory_emptyBody(): void
    {
        $req = $this->createAdminRequest('PUT', '/api/admin/stories/s1');
        $resp = $this->controller->updateStory($req, $this->createResponse(), ['uuidStory' => 's1']);
        $this->assertEquals(400, $resp->getStatusCode());
    }

    // === Guard all endpoints ===

    public function testUpdateStory_guestForbidden(): void
    {
        $req = $this->createGuestRequest('PUT', '/api/admin/stories/s1');
        $resp = $this->controller->updateStory($req, $this->createResponse(), ['uuidStory' => 's1']);
        $this->assertEquals(403, $resp->getStatusCode());
    }

    public function testCreateEntity_guestForbidden(): void
    {
        $req = $this->createGuestRequest('POST', '/api/admin/stories/s1/locations');
        $resp = $this->controller->createEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations']);
        $this->assertEquals(403, $resp->getStatusCode());
    }

    public function testGetEntity_guestForbidden(): void
    {
        $req = $this->createGuestRequest('GET', '/api/admin/stories/s1/locations/e1');
        $resp = $this->controller->getEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'e1']);
        $this->assertEquals(403, $resp->getStatusCode());
    }

    public function testUpdateEntity_guestForbidden(): void
    {
        $req = $this->createGuestRequest('PUT', '/api/admin/stories/s1/locations/e1');
        $resp = $this->controller->updateEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'e1']);
        $this->assertEquals(403, $resp->getStatusCode());
    }

    public function testDeleteEntity_guestForbidden(): void
    {
        $req = $this->createGuestRequest('DELETE', '/api/admin/stories/s1/locations/e1');
        $resp = $this->controller->deleteEntity($req, $this->createResponse(), ['uuidStory' => 's1', 'entityType' => 'locations', 'entityUuid' => 'e1']);
        $this->assertEquals(403, $resp->getStatusCode());
    }
}
