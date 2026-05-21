package games.paths.adapters.rest.controller.dev;

import games.paths.core.model.dev.CleanupResult;
import games.paths.core.port.dev.TestDataCleanupPort;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * DevController - REST adapter for dev-only maintenance endpoints.
 *
 * <p>POST /api/dev/cleanup → removes the rows created by automated (Robot
 * Framework) test runs — guests and matches carrying the {@code robottest}
 * marker — while preserving every other row.</p>
 *
 * <p>The endpoint returns 403 unless {@code game.dev.test-endpoints-enabled}
 * is {@code true}, so it is inert in production deployments (the prod profile
 * sets it to {@code false}).</p>
 */
@RestController
@RequestMapping("/api/dev")
public class DevController {

    private final TestDataCleanupPort testDataCleanupPort;
    private final boolean testEndpointsEnabled;

    public DevController(TestDataCleanupPort testDataCleanupPort,
                         @Value("${game.dev.test-endpoints-enabled:false}") boolean testEndpointsEnabled) {
        this.testDataCleanupPort = testDataCleanupPort;
        this.testEndpointsEnabled = testEndpointsEnabled;
    }

    /**
     * POST /api/dev/cleanup
     * Deletes all guests and matches created by automated test runs.
     */
    @PostMapping("/cleanup")
    public ResponseEntity<Object> cleanup() {
        if (!testEndpointsEnabled) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put("error", "DEV_ENDPOINTS_DISABLED");
            error.put("message", "Dev test endpoints are disabled on this environment");
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(error);
        }

        CleanupResult result = testDataCleanupPort.cleanupTestData();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("deletedGuests", result.deletedGuests());
        body.put("deletedMatches", result.deletedMatches());
        return ResponseEntity.ok(body);
    }
}
