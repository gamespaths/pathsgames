<?php

namespace Games\Paths\Adapter\Rest;

use Games\Paths\Core\Port\EchoPort;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class EchoController
{
    private EchoPort $echoService;

    public function __construct(EchoPort $echoService)
    {
        $this->echoService = $echoService;
    }

    public function getStatus(Request $request, Response $response, array $args): Response
    {
        $status = $this->echoService->getStatus();
        
        $response->getBody()->write(json_encode($status));
        return $response->withHeader('Content-Type', 'application/json')->withStatus(200);
    }
}
