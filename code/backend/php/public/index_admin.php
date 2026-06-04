<?php

/**
 * Admin front controller — every /api/admin/** endpoint, served ONLY on the admin port
 * (default 8044). Run it alongside index.php, e.g.:
 *
 *     php -S localhost:8044 -t public public/index_admin.php
 *
 * Lock the admin port to the owner IP at the network layer (firewall / security group).
 * See public/bootstrap.php for the shared wiring and src/Adapter/Rest/RouteRegistrar.php
 * for the route definitions.
 */

use Games\Paths\Adapter\Rest\RouteRegistrar;

$ctx = require __DIR__ . '/bootstrap.php';

/** @var \Slim\App $app */
$app = $ctx['app'];

RouteRegistrar::registerAdmin($app, $ctx['controllers'], $ctx['authMiddleware']);

$app->run();
