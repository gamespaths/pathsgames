<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest;

use Games\Paths\Adapter\Rest\EchoController;
use Games\Paths\Core\Port\EchoPort;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

class EchoControllerTest extends TestCase
{
    public function testGetStatus(): void
    {
        $mockEchoService = $this->createMock(EchoPort::class);
        $mockEchoService->expects($this->once())
            ->method('getStatus')
            ->willReturn(['status' => 'ok', 'env' => 'test']);

        $controller = new EchoController($mockEchoService);

        $request = (new ServerRequestFactory())->createServerRequest('GET', '/status');
        $response = (new ResponseFactory())->createResponse();

        $resultResponse = $controller->getStatus($request, $response, []);

        $this->assertSame(200, $resultResponse->getStatusCode());
        $this->assertSame('application/json', $resultResponse->getHeaderLine('Content-Type'));
        
        $body = (string) $resultResponse->getBody();
        $data = json_decode($body, true);
        
        $this->assertSame('ok', $data['status']);
        $this->assertSame('test', $data['env']);
    }
}
