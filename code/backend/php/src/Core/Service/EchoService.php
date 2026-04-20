<?php

namespace Games\Paths\Core\Service;

use Games\Paths\Core\Port\EchoPort;

class EchoService implements EchoPort
{
    public function getStatus(): array
    {
        return [
            'status' => 'OK',
            'timestamp' => time() * 1000,
            'properties' => [
                'env' => getenv('APP_ENV') ?: 'development',
                'version' => getenv('APP_VERSION') ?: '0.16.2',
                'applicationName' => 'paths-game-backend-php',
                'phpVersion' => PHP_VERSION,
            ]
        ];
    }
}
