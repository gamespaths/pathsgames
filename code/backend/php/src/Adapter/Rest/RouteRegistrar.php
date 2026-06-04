<?php

namespace Games\Paths\Adapter\Rest;

use Slim\App;
use Slim\Routing\RouteCollectorProxy;

/**
 * RouteRegistrar — registers the public/player routes and the admin routes on a Slim app.
 *
 * The two route sets are mounted by two different front controllers:
 *   * index.php       → registerPublic(): everything EXCEPT /api/admin/** (public port 8042)
 *   * index_admin.php → registerAdmin():  ONLY /api/admin/** (admin port 8044)
 *
 * Keeping the registration here (instead of inline in the entry files) makes the strict
 * public/admin split unit-testable without running a real HTTP server.
 *
 * @param array<string, object> $c controllers map from bootstrap.php
 */
class RouteRegistrar
{
    public static function registerPublic(App $app, array $c, $authMiddleware): void
    {
        $app->group('/api', function (RouteCollectorProxy $group) use ($c) {
            // Echo (Public)
            $group->get('/echo/status', [$c['echo'], 'getStatus']);

            // Auth - Guest (Public)
            $group->post('/auth/guest', [$c['guestAuth'], 'createGuest']);
            $group->post('/auth/guest/resume', [$c['guestAuth'], 'resumeGuest']);

            // Session Management
            $group->post('/auth/refresh', [$c['session'], 'refresh']);
            $group->get('/auth/me', [$c['session'], 'me']);
            $group->post('/auth/logout', [$c['session'], 'logout']);
            $group->post('/auth/logout/all', [$c['session'], 'logoutAll']);

            // Stories (Public)
            $group->get('/stories', [$c['story'], 'listStories']);
            $group->get('/stories/categories', [$c['story'], 'listCategories']);
            $group->get('/stories/groups', [$c['story'], 'listGroups']);
            $group->get('/stories/category/{category}', [$c['story'], 'listStoriesByCategory']);
            $group->get('/stories/group/{group}', [$c['story'], 'listStoriesByGroup']);
            $group->get('/stories/{uuid}', [$c['story'], 'getStory']);

            // Content Detail (Public)
            $group->get('/content/{uuidStory}/cards/{uuidCard}', [$c['content'], 'getCard']);
            $group->get('/content/{uuidStory}/texts/{idText}/lang/{lang}', [$c['content'], 'getText']);
            $group->get('/content/{uuidStory}/creators/{uuidCreator}', [$c['content'], 'getCreator']);

            // Step 19 — Single-player match (player)
            $group->post('/matches', [$c['match'], 'createMatch']);
            $group->get('/matches', [$c['match'], 'listMatches']);
            $group->get('/match/{uuidMatch}/info', [$c['match'], 'getMatchInfo']);

            // Step 20.1 — Player ends a match by supplying the story's end-game event uuid
            $group->patch('/match/{uuidMatch}/end/{uuidEvent}', [$c['match'], 'endMatch']);
        })->add($authMiddleware);
    }

    public static function registerAdmin(App $app, array $c, $authMiddleware): void
    {
        $app->group('/api', function (RouteCollectorProxy $group) use ($c) {
            // Health check — same EchoService as the public API, so the admin endpoint
            // can be monitored independently.
            $group->get('/echo/status', [$c['echo'], 'getStatus']);

            // Dev — test-data cleanup (dev-only): served on the admin endpoint (IP-secured).
            $group->post('/dev/cleanup', [$c['dev'], 'cleanup']);

            // Admin - Guest
            $group->get('/admin/guests', [$c['guestAdmin'], 'listGuests']);
            $group->get('/admin/guests/stats', [$c['guestAdmin'], 'getGuestStats']);
            $group->delete('/admin/guests/expired', [$c['guestAdmin'], 'cleanupExpired']);
            $group->get('/admin/guests/{uuid}', [$c['guestAdmin'], 'getGuest']);
            $group->delete('/admin/guests/{uuid}', [$c['guestAdmin'], 'deleteGuest']);

            // Admin - Stories
            $group->get('/admin/stories', [$c['storyAdmin'], 'listAllStories']);
            $group->post('/admin/stories/import', [$c['storyAdmin'], 'importStory']);
            $group->delete('/admin/stories/{uuid}', [$c['storyAdmin'], 'deleteStory']);

            // Admin - Story Entity CRUD (Step 17)
            $group->post('/admin/stories', [$c['storyCrudAdmin'], 'createStory']);
            $group->get('/admin/stories/{uuidStory}', [$c['storyCrudAdmin'], 'getStory']);
            $group->put('/admin/stories/{uuidStory}', [$c['storyCrudAdmin'], 'updateStory']);
            $group->get('/admin/stories/{uuidStory}/{entityType}', [$c['storyCrudAdmin'], 'listEntities']);
            $group->post('/admin/stories/{uuidStory}/{entityType}', [$c['storyCrudAdmin'], 'createEntity']);
            $group->get('/admin/stories/{uuidStory}/{entityType}/{entityUuid}', [$c['storyCrudAdmin'], 'getEntity']);
            $group->put('/admin/stories/{uuidStory}/{entityType}/{entityUuid}', [$c['storyCrudAdmin'], 'updateEntity']);
            $group->delete('/admin/stories/{uuidStory}/{entityType}/{entityUuid}', [$c['storyCrudAdmin'], 'deleteEntity']);

            // Admin — match management (Step 20.x)
            $group->get('/admin/matches', [$c['matchAdmin'], 'listAllMatches']);
            $group->get('/admin/matches/statuses', [$c['matchAdmin'], 'listMatchStatuses']);
            $group->get('/admin/matches/{uuidMatch}/info', [$c['matchAdmin'], 'getAdminMatchInfo']);
            $group->put('/admin/matches/{uuidMatch}', [$c['matchAdmin'], 'updateMatch']);
            $group->post('/admin/matches/{uuidMatch}/stop', [$c['matchAdmin'], 'stopMatch']);
            $group->post('/admin/matches/{uuidMatch}/pause', [$c['matchAdmin'], 'pauseMatch']);
            $group->post('/admin/matches/{uuidMatch}/resume', [$c['matchAdmin'], 'resumeMatch']);
            $group->delete('/admin/matches/{uuidMatch}', [$c['matchAdmin'], 'deleteMatch']);
        })->add($authMiddleware);
    }
}
