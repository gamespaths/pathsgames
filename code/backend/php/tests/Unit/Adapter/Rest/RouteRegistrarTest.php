<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Rest;

use Games\Paths\Adapter\Rest\RouteRegistrar;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\App;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

/**
 * Verifies the strict public/admin route split:
 *   * the public app exposes player/public routes and NO /api/admin/** route
 *   * the admin app exposes ONLY /api/admin/** routes and no public route
 *
 * Controllers are stubbed so we test routing/dispatch, not handler logic.
 */
class RouteRegistrarTest extends TestCase
{
    private function stubControllers(): array
    {
        // Every controller method returns a 200 response (2nd invocation argument).
        $stub = new class {
            public function __call($name, $args)
            {
                return $args[1]->withStatus(200);
            }
        };
        return array_fill_keys([
            'echo', 'guestAuth', 'guestAdmin', 'session', 'story', 'storyAdmin',
            'content', 'storyCrudAdmin', 'match', 'matchAdmin', 'dev',
        ], $stub);
    }

    private function passThroughMiddleware(): callable
    {
        return function (ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface {
            return $handler->handle($request);
        };
    }

    private function buildApp(string $which): App
    {
        $app = AppFactory::create();
        $app->addRoutingMiddleware();
        $app->addErrorMiddleware(false, false, false);
        if ($which === 'public') {
            RouteRegistrar::registerPublic($app, $this->stubControllers(), $this->passThroughMiddleware());
        } else {
            RouteRegistrar::registerAdmin($app, $this->stubControllers(), $this->passThroughMiddleware());
        }
        return $app;
    }

    private function dispatchStatus(App $app, string $method, string $path): int
    {
        $request = (new ServerRequestFactory())->createServerRequest($method, $path);
        return $app->handle($request)->getStatusCode();
    }

    public function testPublicAppServesPlayerRoutes(): void
    {
        $app = $this->buildApp('public');
        $this->assertSame(200, $this->dispatchStatus($app, 'GET', '/api/matches'));
        $this->assertSame(200, $this->dispatchStatus($app, 'GET', '/api/echo/status'));
        $this->assertSame(200, $this->dispatchStatus($app, 'GET', '/api/stories'));
    }

    public function testPublicAppDoesNotServeAdminRoutes(): void
    {
        $app = $this->buildApp('public');
        $this->assertSame(404, $this->dispatchStatus($app, 'GET', '/api/admin/matches'));
        $this->assertSame(404, $this->dispatchStatus($app, 'GET', '/api/admin/matches/statuses'));
        $this->assertSame(404, $this->dispatchStatus($app, 'GET', '/api/admin/stories'));
        $this->assertSame(404, $this->dispatchStatus($app, 'GET', '/api/admin/guests'));
        // Dev maintenance endpoints moved to the admin endpoint.
        $this->assertSame(404, $this->dispatchStatus($app, 'POST', '/api/dev/cleanup'));
    }

    public function testAdminAppServesAdminRoutes(): void
    {
        $app = $this->buildApp('admin');
        $this->assertSame(200, $this->dispatchStatus($app, 'GET', '/api/admin/matches'));
        $this->assertSame(200, $this->dispatchStatus($app, 'GET', '/api/admin/matches/statuses'));
        $this->assertSame(200, $this->dispatchStatus($app, 'GET', '/api/admin/stories'));
        $this->assertSame(200, $this->dispatchStatus($app, 'GET', '/api/admin/guests'));
    }

    public function testAdminAppServesHealthCheck(): void
    {
        // The /api/echo/status health check is intentionally exposed on the admin app too.
        $app = $this->buildApp('admin');
        $this->assertSame(200, $this->dispatchStatus($app, 'GET', '/api/echo/status'));
    }

    public function testAdminAppServesDevCleanup(): void
    {
        // Dev-only test-data cleanup is served on the admin endpoint (IP-secured).
        $app = $this->buildApp('admin');
        $this->assertSame(200, $this->dispatchStatus($app, 'POST', '/api/dev/cleanup'));
    }

    public function testAdminAppDoesNotServePublicRoutes(): void
    {
        $app = $this->buildApp('admin');
        $this->assertSame(404, $this->dispatchStatus($app, 'GET', '/api/matches'));
        $this->assertSame(404, $this->dispatchStatus($app, 'GET', '/api/stories'));
    }
}
