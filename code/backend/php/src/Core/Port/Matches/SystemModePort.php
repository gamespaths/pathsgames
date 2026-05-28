<?php

namespace Games\Paths\Core\Port\Matches;

interface SystemModePort
{
    public function isMaintenance(): bool;
}
