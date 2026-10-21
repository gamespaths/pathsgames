package games.paths.adapters.rest.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import games.paths.core.port.EchoPort;
import games.paths.core.port.auth.GoogleLoginPort;

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
    private final GoogleLoginPort googleLoginPort;

    public EchoController(EchoPort echoPort) {
        this(echoPort, null);
    }

    /** v1.2.0 the Google sign-in switch and the client id, read by react-game at runtime. */
    @org.springframework.beans.factory.annotation.Autowired
    public EchoController(EchoPort echoPort, GoogleLoginPort googleLoginPort) {
        this.echoPort = echoPort;
        this.googleLoginPort = googleLoginPort;
    }

    @GetMapping("/status")
    public Map<String, Object> getStatus() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", echoPort.getServerStatus());
        response.put("timestamp", echoPort.getTimestamp());
        response.put("properties", echoPort.getServerProperties());
        if (googleLoginPort != null) {
            response.put("googleEnabled", googleLoginPort.isEnabled());
            response.put("googleClientId", googleLoginPort.clientId());
        }
        return response;
    }
}
