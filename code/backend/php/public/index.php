<?php

// Load root project .env (four levels up: public/ → php/ → backend/ → code/ → root)
// Only sets variables not already present in the environment (system env takes priority).
(static function () {
    $rootEnv = dirname(__DIR__, 4) . '/.env';
    if (!file_exists($rootEnv)) {
        return;
    }
    $lines = file($rootEnv, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(ltrim($line), '#') || !str_contains($line, '=')) {
            continue;
        }
        [$key, $val] = array_map('trim', explode('=', $line, 2));
        $val = trim($val, "'\"");
        if ($key !== '' && getenv($key) === false) {
            putenv("$key=$val");
        }
    }
})();

require __DIR__ . '/../vendor/autoload.php';

use Slim\Factory\AppFactory;
use Games\Paths\Core\Service\EchoService;
use Games\Paths\Core\Service\Auth\GuestAuthService;
use Games\Paths\Core\Service\Auth\GuestAdminService;
use Games\Paths\Adapter\Auth\JwtAdapter;
use Games\Paths\Adapter\Auth\Persistence\Mysql\GuestMysqlRepository;
use Games\Paths\Adapter\Auth\Persistence\Mysql\TokenMysqlRepository;
use Games\Paths\Adapter\Rest\EchoController;
use Games\Paths\Adapter\Auth\Rest\GuestAuthController;
use Games\Paths\Adapter\Auth\Rest\GuestAdminController;
use Games\Paths\Adapter\Auth\Rest\SessionController;
use Games\Paths\Adapter\Rest\Middleware\JwtAuthenticationMiddleware;
use Games\Paths\Core\Service\Auth\SessionService;

use Games\Paths\Adapter\Persistence\Story\StoryMysqlReadRepository;
use Games\Paths\Adapter\Persistence\Story\StoryMysqlPersistenceRepository;
use Games\Paths\Core\Service\Story\StoryQueryService;
use Games\Paths\Core\Service\Story\StoryImportService;
use Games\Paths\Adapter\Rest\Story\StoryController;
use Games\Paths\Adapter\Rest\Story\StoryAdminController;
use Games\Paths\Core\Service\Story\ContentQueryService;
use Games\Paths\Adapter\Rest\Story\ContentController;

use Games\Paths\Core\Service\Story\StoryCrudService;
use Games\Paths\Adapter\Rest\Story\StoryCrudAdminController;

// Step 19 — single-player match creation
use Games\Paths\Adapter\Persistence\Matches\MatchMysqlPersistenceAdapter;
use Games\Paths\Adapter\Persistence\Matches\StoryMatchMysqlReadAdapter;
use Games\Paths\Adapter\Persistence\Matches\UserAccessMysqlAdapter;
use Games\Paths\Core\Service\Matches\MatchCommandService;
use Games\Paths\Core\Service\Matches\MatchQueryService;
use Games\Paths\Core\Service\Matches\PropertySystemModeService;
use Games\Paths\Adapter\Rest\Matches\MatchController;
use Games\Paths\Adapter\Turnstile\TurnstileVerificationAdapter;

// Dev-only test-data cleanup
use Games\Paths\Core\Service\Dev\TestDataCleanupService;
use Games\Paths\Adapter\Rest\Dev\DevController;

// Enable error reporting only in development
$appEnv = getenv('APP_ENV') ?: 'development';

// Dev-only test endpoints (POST /api/dev/cleanup) + X-Test-Marker header.
// Defaults to enabled in development; override with DEV_TEST_ENDPOINTS_ENABLED.
$devTestEndpointsEnabled = getenv('DEV_TEST_ENDPOINTS_ENABLED') !== false
    ? getenv('DEV_TEST_ENDPOINTS_ENABLED') === 'true'
    : ($appEnv === 'development');
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
$app = \Slim\Factory\AppFactory::create();

// Add default middleware (Routing & Error Handling)
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

// Add CORS Middleware
$app->add(function (\Psr\Http\Message\ServerRequestInterface $request, \Psr\Http\Server\RequestHandlerInterface $handler) use ($allowAllOrigins, $allowedOriginsList) {
    $response = $handler->handle($request);

    $origin = $request->getHeaderLine('Origin');
    $allowed = false;

    if ($allowAllOrigins) {
        $allowed = $origin ?: '*';
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
$tokenRepo = new TokenMysqlRepository($pdo);
$storyReadRepo = new StoryMysqlReadRepository($pdo);
$storyPersistRepo = new StoryMysqlPersistenceRepository($pdo);

// ─── Initialize Core Services ───
$echoService = new EchoService();
$sessionService = new SessionService($jwtAdapter, $tokenRepo, 5);
$guestAuthService = new GuestAuthService($guestRepo, $jwtAdapter);
$guestAdminService = new GuestAdminService($guestRepo);
$storyQueryService = new StoryQueryService($storyReadRepo);
$storyImportService = new StoryImportService($storyPersistRepo);
$contentQueryService = new ContentQueryService($storyReadRepo);
$storyCrudService = new StoryCrudService($storyReadRepo, $storyPersistRepo);

// Step 19 — match wiring
$matchPersistenceRepo = new MatchMysqlPersistenceAdapter($pdo);
$storyMatchReadRepo = new StoryMatchMysqlReadAdapter($pdo);
$userAccessRepo = new UserAccessMysqlAdapter($pdo);
$matchSystemModeService = new PropertySystemModeService('OK');
$turnstileSecretKey = getenv('TURNSTILE_SECRET_KEY') ?: '';
$turnstileBypassToken = getenv('TURNSTILE_BYPASS_TOKEN') ?: '';
$appEnv = getenv('APP_ENV') ?: 'dev';
$turnstileAdapter = new TurnstileVerificationAdapter(
    $turnstileSecretKey,
    $turnstileBypassToken,
    $appEnv
);
$matchCommandService = new MatchCommandService(
    $storyMatchReadRepo,
    $matchPersistenceRepo,
    $userAccessRepo,
    $matchSystemModeService,
    $turnstileAdapter
);
$matchQueryService = new MatchQueryService(
    $matchPersistenceRepo,
    $storyMatchReadRepo,
    $userAccessRepo
);

// Dev-only test-data cleanup service
$testDataCleanupService = new TestDataCleanupService($guestRepo, $matchPersistenceRepo);

// ─── Initialize Rest Controllers ───
$echoController = new EchoController($echoService);
$guestAuthController = new GuestAuthController($guestAuthService, $jwtAdapter, $tokenRepo, $devTestEndpointsEnabled);
$guestAdminController = new GuestAdminController($guestAdminService);
$sessionController = new SessionController($sessionService);
$storyController = new StoryController($storyQueryService);
$storyAdminController = new StoryAdminController($storyQueryService, $storyImportService);
$contentController = new ContentController($contentQueryService);
$storyCrudAdminController = new StoryCrudAdminController($storyCrudService);
$matchController = new MatchController($matchCommandService, $matchQueryService);
$devController = new DevController($testDataCleanupService, $devTestEndpointsEnabled);

// ─── Authentication Middleware ───
$publicPaths = [
    '/api/echo/status',
    '/api/auth/guest',
    '/api/auth/guest/resume',
    '/api/auth/refresh',
    '/api/stories',
    '/api/stories/**',
    '/api/content/**',
    '/api/dev/**'
];
$authMiddleware = new JwtAuthenticationMiddleware($sessionService, $publicPaths);

// ─── Define Routes ───
$app->group('/api', function (\Slim\Routing\RouteCollectorProxy $group) use (
    $echoController, $guestAuthController, $guestAdminController, $sessionController,
    $storyController, $storyAdminController, $contentController, $storyCrudAdminController,
    $matchController, $devController
) {
    
    // Echo (Public)
    $group->get('/echo/status', [$echoController, 'getStatus']);
    
    // Auth - Guest (Public)
    $group->post('/auth/guest', [$guestAuthController, 'createGuest']);
    $group->post('/auth/guest/resume', [$guestAuthController, 'resumeGuest']);
    
    // Session Management (Mostly Public or protected by their own logic)
    $group->post('/auth/refresh', [$sessionController, 'refresh']); // Public (reads cookie)
    $group->get('/auth/me', [$sessionController, 'me']);          // Protected (via middleware)
    $group->post('/auth/logout', [$sessionController, 'logout']);     // Protected (via middleware)
    $group->post('/auth/logout/all', [$sessionController, 'logoutAll']); // Protected (via middleware)

    // Admin - Guest (Protected)
    $group->get('/admin/guests', [$guestAdminController, 'listGuests']);
    $group->get('/admin/guests/stats', [$guestAdminController, 'getGuestStats']);
    $group->delete('/admin/guests/expired', [$guestAdminController, 'cleanupExpired']);
    $group->get('/admin/guests/{uuid}', [$guestAdminController, 'getGuest']);
    $group->delete('/admin/guests/{uuid}', [$guestAdminController, 'deleteGuest']);

    // Stories (Public)
    $group->get('/stories', [$storyController, 'listStories']);
    $group->get('/stories/categories', [$storyController, 'listCategories']);
    $group->get('/stories/groups', [$storyController, 'listGroups']);
    $group->get('/stories/category/{category}', [$storyController, 'listStoriesByCategory']);
    $group->get('/stories/group/{group}', [$storyController, 'listStoriesByGroup']);
    $group->get('/stories/{uuid}', [$storyController, 'getStory']);

    // Admin - Stories (Protected)
    $group->get('/admin/stories', [$storyAdminController, 'listAllStories']);
    $group->post('/admin/stories/import', [$storyAdminController, 'importStory']);
    $group->delete('/admin/stories/{uuid}', [$storyAdminController, 'deleteStory']);

    // Content Detail (Public)
    $group->get('/content/{uuidStory}/cards/{uuidCard}', [$contentController, 'getCard']);
    $group->get('/content/{uuidStory}/texts/{idText}/lang/{lang}', [$contentController, 'getText']);
    $group->get('/content/{uuidStory}/creators/{uuidCreator}', [$contentController, 'getCreator']);

    // Admin - Story Entity CRUD (Step 17, Protected)
    $group->post('/admin/stories', [$storyCrudAdminController, 'createStory']);
    $group->get('/admin/stories/{uuidStory}', [$storyCrudAdminController, 'getStory']);
    $group->put('/admin/stories/{uuidStory}', [$storyCrudAdminController, 'updateStory']);
    $group->get('/admin/stories/{uuidStory}/{entityType}', [$storyCrudAdminController, 'listEntities']);
    $group->post('/admin/stories/{uuidStory}/{entityType}', [$storyCrudAdminController, 'createEntity']);
    $group->get('/admin/stories/{uuidStory}/{entityType}/{entityUuid}', [$storyCrudAdminController, 'getEntity']);
    $group->put('/admin/stories/{uuidStory}/{entityType}/{entityUuid}', [$storyCrudAdminController, 'updateEntity']);
    $group->delete('/admin/stories/{uuidStory}/{entityType}/{entityUuid}', [$storyCrudAdminController, 'deleteEntity']);

    // Step 19 — Single-player match creation
    $group->post('/matches', [$matchController, 'createMatch']);
    $group->get('/matches', [$matchController, 'listMatches']);
    $group->get('/admin/matches', [$matchController, 'listAllMatches']);
    $group->get('/match/{uuidMatch}/info', [$matchController, 'getMatchInfo']);

    // Step 20.1 — Player ends a match by supplying the story's end-game event uuid
    $group->patch('/match/{uuidMatch}/end/{uuidEvent}', [$matchController, 'endMatch']);

    // Admin — match control (modify / stop / delete)
    $group->get('/admin/matches/statuses', [$matchController, 'listMatchStatuses']);
    $group->get('/admin/matches/{uuidMatch}/info', [$matchController, 'getAdminMatchInfo']);
    $group->put('/admin/matches/{uuidMatch}', [$matchController, 'updateMatch']);
    $group->post('/admin/matches/{uuidMatch}/stop', [$matchController, 'stopMatch']);
    $group->post('/admin/matches/{uuidMatch}/pause', [$matchController, 'pauseMatch']);
    $group->post('/admin/matches/{uuidMatch}/resume', [$matchController, 'resumeMatch']);
    $group->delete('/admin/matches/{uuidMatch}', [$matchController, 'deleteMatch']);

    // Dev — test-data cleanup (dev-only, returns 403 when disabled)
    $group->post('/dev/cleanup', [$devController, 'cleanup']);
})->add($authMiddleware);

$app->run();
