package games.paths.adapterRest.controller;

import games.paths.core.port.in.EchoPort;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * EchoController - REST adapter that exposes the EchoPort.
 * GET /api/echo/status → returns timestamp, server status, and server properties.
 */
@RestController
@RequestMapping("/api/echo")
public class EchoController {

    private final EchoPort echoPort;

    public EchoController(EchoPort echoPort) {
        this.echoPort = echoPort;
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", echoPort.getServerStatus());
        response.put("timestamp", echoPort.getTimestamp());
        response.put("properties", echoPort.getServerProperties());
        return response;
    }
}
