<?php

/**
 * Public front controller — player/public API on the public port (default 8042).
 *
 * Serves everything EXCEPT /api/admin/**. The admin surface lives in index_admin.php on
 * the admin port (default 8044). See public/bootstrap.php for the shared wiring and
 * src/Adapter/Rest/RouteRegistrar.php for the route definitions.
 */

use Games\Paths\Adapter\Rest\RouteRegistrar;

$ctx = require __DIR__ . '/bootstrap.php';

/** @var \Slim\App $app */
$app = $ctx['app'];

RouteRegistrar::registerPublic($app, $ctx['controllers'], $ctx['authMiddleware']);

$app->run();
