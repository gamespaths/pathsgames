<?php

declare(strict_types=1);

namespace Games\Paths\Adapter\Rest\Story;

use Games\Paths\Core\Port\Story\ContentQueryPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class ContentController
{
    private ContentQueryPort $queryPort;

    public function __construct(ContentQueryPort $queryPort)
    {
        $this->queryPort = $queryPort;
    }

    public function getCard(Request $request, Response $response, array $args): Response
    {
        $storyUuid = $args['uuidStory'] ?? '';
        $cardUuid = $args['uuidCard'] ?? '';
        $lang = $request->getQueryParams()['lang'] ?? 'en';

        $card = $this->queryPort->getCardByStoryAndCardUuid($storyUuid, $cardUuid, $lang);

        if (!$card) {
            $response->getBody()->write(json_encode([
                'error' => 'CARD_NOT_FOUND',
                'message' => "No card found with UUID: $cardUuid in story: $storyUuid"
            ]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode($card));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getText(Request $request, Response $response, array $args): Response
    {
        $storyUuid = $args['uuidStory'] ?? '';
        $idText = (int)($args['idText'] ?? 0);
        $lang = $args['lang'] ?? 'en';

        $text = $this->queryPort->getTextByStoryAndIdText($storyUuid, $idText, $lang);

        if (!$text) {
            $response->getBody()->write(json_encode([
                'error' => 'TEXT_NOT_FOUND',
                'message' => "No text found with id_text: $idText in story: $storyUuid"
            ]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode($text));
        return $response->withHeader('Content-Type', 'application/json');
    }

    public function getCreator(Request $request, Response $response, array $args): Response
    {
        $storyUuid = $args['uuidStory'] ?? '';
        $creatorUuid = $args['uuidCreator'] ?? '';
        $lang = $request->getQueryParams()['lang'] ?? 'en';

        $creator = $this->queryPort->getCreatorByStoryAndCreatorUuid($storyUuid, $creatorUuid, $lang);

        if (!$creator) {
            $response->getBody()->write(json_encode([
                'error' => 'CREATOR_NOT_FOUND',
                'message' => "No creator found with UUID: $creatorUuid in story: $storyUuid"
            ]));
            return $response->withStatus(404)->withHeader('Content-Type', 'application/json');
        }

        $response->getBody()->write(json_encode($creator));
        return $response->withHeader('Content-Type', 'application/json');
    }
}
