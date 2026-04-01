<?php

namespace Games\Paths\Core\Port;

interface EchoPort
{
    /**
     * Retrieves the status of the server.
     *
     * @return array The status and environment information.
     */
    public function getStatus(): array;
}
