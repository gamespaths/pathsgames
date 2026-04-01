<?php

require __DIR__ . '/../vendor/autoload.php';

use Slim\Factory\AppFactory;
use Games\Paths\Core\Service\EchoService;
use Games\Paths\Core\Service\GuestAuthService;
use Games\Paths\Core\Service\GuestAdminService;
use Games\Paths\Adapter\Auth\JwtAdapter;
use Games\Paths\Adapter\Persistence\Mysql\GuestMysqlRepository;
use Games\Paths\Adapter\Rest\EchoController;
use Games\Paths\Adapter\Rest\GuestAuthController;
use Games\Paths\Adapter\Rest\GuestAdminController;

// Enable error reporting only in development
$appEnv = getenv('APP_ENV') ?: 'development';
if ($appEnv === 'development') {
    error_reporting(E_ALL);
    ini_set('display_errors', '1');
} else {
    error_reporting(0);
    ini_set('display_errors', '0');
}

// ─── Configuration (matches Python app/config.py) ───
$jwtSecret = getenv('JWT_SECRET') ?: 'PathsGamesDevSecret2026_MustBeAtLeast32Chars!';
$accessTokenMinutes = (int)(getenv('ACCESS_TOKEN_MINUTES') ?: 30);
$refreshTokenDays = (int)(getenv('REFRESH_TOKEN_DAYS') ?: 7);

// ─── CORS allowed origins ───
// Set CORS_ALLOWED_ORIGINS env var to a comma-separated list of origins.
// Use "*" (default) only in development.
$corsOriginsEnv = getenv('CORS_ALLOWED_ORIGINS') ?: '*';
$allowAllOrigins = $corsOriginsEnv === '*';
$allowedOriginsList = $allowAllOrigins
    ? []
    : array_map('trim', explode(',', $corsOriginsEnv));

// ─── Database Connection ───
$dbHost = getenv('DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('DB_PORT') ?: '3306';
$dbUser = getenv('DB_USER') ?: 'pathsgames';
$dbPass = getenv('DB_PASS') ?: 'pathsgames';
$dbName = getenv('DB_NAME') ?: 'pathsgames';

try {
    $pdo = new PDO(
        "mysql:host=$dbHost;port=$dbPort;dbname=$dbName;charset=utf8mb4",
        $dbUser,
        $dbPass,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
} catch (PDOException $e) {
    die(json_encode(['error' => 'Database connection failed', 'message' => $e->getMessage()]));
}

// ─── Instantiate App ───
$app = AppFactory::create();

// Add default middleware (Routing & Error Handling)
$app->addRoutingMiddleware();

// Add CORS Middleware
$app->add(function (\Psr\Http\Message\ServerRequestInterface $request, \Psr\Http\Server\RequestHandlerInterface $handler) use ($allowAllOrigins, $allowedOriginsList) {
    $response = $handler->handle($request);

    $origin = $request->getHeaderLine('Origin');
    $allowed = false;

    if ($allowAllOrigins) {
        $allowed = '*';
    } elseif ($origin && in_array($origin, $allowedOriginsList, true)) {
        $allowed = $origin;
    }

    if ($allowed) {
        $response = $response
            ->withHeader('Access-Control-Allow-Origin', $allowed)
            ->withHeader('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type, Accept, Origin, Authorization')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
            ->withHeader('Access-Control-Allow-Credentials', 'true');
    }

    return $response;
});

// Setup OPTIONS Catch-all for preflight requests
$app->options('/{routes:.+}', function ($request, $response, $args) {
    return $response;
});

// In dev we keep displayErrorDetails as true
$isDebug = $appEnv === 'development';
$app->addErrorMiddleware($isDebug, $isDebug, $isDebug);

// ─── Initialize Adapters (Hexagonal Architecture wiring) ───
$jwtAdapter = new JwtAdapter($jwtSecret, $accessTokenMinutes, $refreshTokenDays);
$guestRepo = new GuestMysqlRepository($pdo);

// ─── Initialize Core Services ───
$echoService = new EchoService();
$guestAuthService = new GuestAuthService($guestRepo, $jwtAdapter);
$guestAdminService = new GuestAdminService($guestRepo);

// ─── Initialize Rest Controllers ───
$echoController = new EchoController($echoService);
$guestAuthController = new GuestAuthController($guestAuthService, $jwtAdapter);
$guestAdminController = new GuestAdminController($guestAdminService);

// ─── Define Routes ───
$app->group('/api', function (\Slim\Routing\RouteCollectorProxy $group) use ($echoController, $guestAuthController, $guestAdminController) {
    
    // Echo
    $group->get('/echo/status', [$echoController, 'getStatus']);
    
    // Auth - Guest
    $group->post('/auth/guest', [$guestAuthController, 'createGuest']);
    $group->post('/auth/guest/resume', [$guestAuthController, 'resumeGuest']);
    
    // Admin - Guest
    $group->get('/admin/guests', [$guestAdminController, 'listGuests']);
    $group->get('/admin/guests/stats', [$guestAdminController, 'getGuestStats']);
    $group->delete('/admin/guests/expired', [$guestAdminController, 'cleanupExpired']);
    $group->get('/admin/guests/{uuid}', [$guestAdminController, 'getGuest']);
    $group->delete('/admin/guests/{uuid}', [$guestAdminController, 'deleteGuest']);
});

$app->run();
