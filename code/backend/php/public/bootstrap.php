<?php

/**
 * Shared bootstrap for the public and admin front controllers.
 *
 * Wires the hexagonal adapters/services/controllers, builds the Slim app with CORS, the
 * OPTIONS preflight catch-all and the error middleware, and returns everything the two
 * entry points (index.php / index_admin.php) need. Each entry point registers its own
 * route set (public vs admin) and calls $app->run(), so the public port (8042) and the
 * admin port (8044) expose disjoint surfaces from a single codebase.
 *
 * @return array{app: \Slim\App, controllers: array<string, object>, authMiddleware: \Games\Paths\Adapter\Rest\Middleware\JwtAuthenticationMiddleware}
 */

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
use Games\Paths\Adapter\Persistence\Matches\CharacterMysqlPersistenceAdapter;
use Games\Paths\Core\Service\Matches\MatchCommandService;
use Games\Paths\Core\Service\Matches\MatchQueryService;
use Games\Paths\Core\Service\Matches\CharacterCommandService;
use Games\Paths\Core\Service\Matches\CharacterQueryService;
use Games\Paths\Core\Service\Matches\PropertySystemModeService;
use Games\Paths\Adapter\Rest\Matches\MatchController;
use Games\Paths\Adapter\Rest\Matches\MatchAdminController;
use Games\Paths\Adapter\Rest\Matches\CharacterController;
use Games\Paths\Adapter\Turnstile\TurnstileVerificationAdapter;

// Dev-only test-data cleanup
use Games\Paths\Core\Service\Dev\TestDataCleanupService;
use Games\Paths\Adapter\Rest\Dev\DevController;

// Enable error reporting only in development
$appEnv = getenv('APP_ENV') ?: 'development';

// Dev-only test endpoints (POST /api/dev/cleanup) + X-Test-Marker header.
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
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();

// CORS Middleware
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

// OPTIONS catch-all for preflight requests
$app->options('/{routes:.+}', function ($request, $response, $args) {
    return $response;
});

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
$storyValidatorService = new \Games\Paths\Core\Service\Story\StoryValidatorService($storyReadRepo);
$storyImportService = new StoryImportService($storyPersistRepo, $storyValidatorService);
$contentQueryService = new ContentQueryService($storyReadRepo);
$storyCrudService = new StoryCrudService($storyReadRepo, $storyPersistRepo, $storyValidatorService);

// Step 19 — match wiring
$matchPersistenceRepo = new MatchMysqlPersistenceAdapter($pdo);
$storyMatchReadRepo = new StoryMatchMysqlReadAdapter($pdo);
$userAccessRepo = new UserAccessMysqlAdapter($pdo);
$matchSystemModeService = new PropertySystemModeService('OK');
$turnstileSecretKey = getenv('TURNSTILE_SECRET_KEY') ?: '';
$turnstileBypassToken = getenv('TURNSTILE_BYPASS_TOKEN') ?: '';
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
// Step 21 — character join wiring
$characterPersistenceRepo = new CharacterMysqlPersistenceAdapter($pdo);
$characterCommandService = new CharacterCommandService(
    $storyMatchReadRepo,
    $matchPersistenceRepo,
    $userAccessRepo,
    $characterPersistenceRepo
);
$characterQueryService = new CharacterQueryService(
    $matchPersistenceRepo,
    $characterPersistenceRepo,
    $storyMatchReadRepo,
    $userAccessRepo
);
$matchQueryService = new MatchQueryService(
    $matchPersistenceRepo,
    $storyMatchReadRepo,
    $userAccessRepo,
    $characterPersistenceRepo
);

// Dev-only test-data cleanup service
$testDataCleanupService = new TestDataCleanupService($guestRepo, $matchPersistenceRepo);

// ─── Initialize Rest Controllers ───
$echoController = new EchoController($echoService);
$guestAuthController = new GuestAuthController($guestAuthService, $jwtAdapter, $tokenRepo, $devTestEndpointsEnabled);
$guestAdminController = new GuestAdminController($guestAdminService);
$sessionController = new SessionController($sessionService);
$storyController = new StoryController($storyQueryService);
$storyAdminController = new StoryAdminController($storyQueryService, $storyImportService, $storyValidatorService);
$contentController = new ContentController($contentQueryService);
$storyCrudAdminController = new StoryCrudAdminController($storyCrudService);
$matchController = new MatchController($matchCommandService, $matchQueryService);
$matchAdminController = new MatchAdminController($matchCommandService, $matchQueryService);
$characterController = new CharacterController($characterCommandService, $characterQueryService);
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

return [
    'app' => $app,
    'authMiddleware' => $authMiddleware,
    'controllers' => [
        'echo' => $echoController,
        'guestAuth' => $guestAuthController,
        'guestAdmin' => $guestAdminController,
        'session' => $sessionController,
        'story' => $storyController,
        'storyAdmin' => $storyAdminController,
        'content' => $contentController,
        'storyCrudAdmin' => $storyCrudAdminController,
        'match' => $matchController,
        'matchAdmin' => $matchAdminController,
        'character' => $characterController,
        'dev' => $devController,
    ],
];
