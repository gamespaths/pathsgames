<?php

namespace Games\Paths\Core\Port\Matches;

interface UserAccessPort
{
    public function findByUuid(string $userUuid): ?array;
}
