<?php

declare(strict_types=1);

namespace Games\Paths\Adapter\Rest\Story;

use Games\Paths\Core\Port\Story\StoryQueryPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class StoryController
{
    private StoryQueryPort $queryPort;

    public function __construct(StoryQueryPort $queryPort)
    {
        $this->queryPort = $queryPort;
    }

    public function listStories(Request $request, Response $response, array $args): Response
    {
        $lang = $request->getQueryParams()['lang'] ?? 'en';
        
        $stories = $this->queryPort->listPublicStories($lang);
        
        $response->getBody()->write(json_encode($stories));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getStory(Request $request, Response $response, array $args): Response
    {
        $uuid = $args['uuid'];
        $lang = $request->getQueryParams()['lang'] ?? 'en';

        $story = $this->queryPort->getStoryDetail($uuid, $lang);

        if (!$story) {
            $response->getBody()->write(json_encode([
                'error' => 'STORY_NOT_FOUND',
                'message' => 'No story found with UUID: ' . $uuid
            ]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode($story));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
