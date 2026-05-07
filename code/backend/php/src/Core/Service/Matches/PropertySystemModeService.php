<?php

namespace Games\Paths\Core\Service\Matches;

use Games\Paths\Core\Port\Matches\SystemModePort;

class PropertySystemModeService implements SystemModePort
{
    public function __construct(private readonly string $serverStatus = '')
    {
    }

    public function isMaintenance(): bool
    {
        return strtolower(trim($this->serverStatus)) === 'maintenance';
    }
}
