<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest\Dev;

use Games\Paths\Adapter\Rest\Dev\DevController;
use Games\Paths\Core\Domain\Dev\CleanupResult;
use Games\Paths\Core\Port\Dev\TestDataCleanupPort;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class DevControllerTest extends TestCase
{
    private function request()
    {
        return (new ServerRequestFactory())->createServerRequest('POST', '/api/dev/cleanup');
    }

    private function response()
    {
        return (new ResponseFactory())->createResponse();
    }

    public function testCleanupReturnsCountsWhenEnabled(): void
    {
        $port = $this->createMock(TestDataCleanupPort::class);
        $port->expects($this->once())->method('cleanupTestData')
            ->willReturn(new CleanupResult(5, 2));
        $controller = new DevController($port, true);

        $response = $controller->cleanup($this->request(), $this->response());

        $this->assertSame(200, $response->getStatusCode());
        $body = json_decode((string)$response->getBody(), true);
        $this->assertSame(['deletedGuests' => 5, 'deletedMatches' => 2], $body);
    }

    public function testCleanupReturns403WhenDisabled(): void
    {
        $port = $this->createMock(TestDataCleanupPort::class);
        $port->expects($this->never())->method('cleanupTestData');
        $controller = new DevController($port, false);

        $response = $controller->cleanup($this->request(), $this->response());

        $this->assertSame(403, $response->getStatusCode());
        $body = json_decode((string)$response->getBody(), true);
        $this->assertSame('DEV_ENDPOINTS_DISABLED', $body['error']);
    }
}
