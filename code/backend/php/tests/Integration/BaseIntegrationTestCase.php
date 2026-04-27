<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Integration;

use PHPUnit\Framework\TestCase;
use Slim\App;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\RequestFactory;
use Slim\Psr7\Factory\ResponseFactory;
use Psr\Http\Message\ResponseInterface;

abstract class BaseIntegrationTestCase extends TestCase
{
    protected function getApp(): App
    {
        // For integration tests, we want to load the real app config but with mocks where possible.
        // However, we can also just use the real app if we have a test database.
        
        // Load the app from index.php but without running it
        // This is tricky because index.php calls $app->run().
        
        // Manual instantiation for testing
        $app = AppFactory::create();
        $app->addBodyParsingMiddleware();
        $app->addRoutingMiddleware();
        
        // Add minimal error middleware (do not display details to avoid noise in test output)
        $app->addErrorMiddleware(false, true, true);
        
        // Routes (simplified subset for testing handlers/middleware)
        $app->get('/api/echo/status', function ($request, $response) {
            $response->getBody()->write(json_encode(['status' => 'OK']));
            return $response->withHeader('Content-Type', 'application/json');
        });
        
        return $app;
    }

    protected function request(string $method, string $path, array $headers = [], string $body = ''): ResponseInterface
    {
        $request = (new RequestFactory())->createRequest($method, $path);
        
        foreach ($headers as $name => $value) {
            $request = $request->withHeader($name, $value);
        }
        
        if ($body !== '') {
            $request->getBody()->write($body);
        }
        
        return $this->getApp()->handle($request);
    }
}
