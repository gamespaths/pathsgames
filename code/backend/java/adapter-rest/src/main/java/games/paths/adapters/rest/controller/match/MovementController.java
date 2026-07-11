package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.MatchLocationsResponse;
import games.paths.adapters.rest.dto.MovementStartRequest;
import games.paths.adapters.rest.dto.MovementStartResponse;
import games.paths.core.port.match.MovementPort;
import games.paths.core.port.match.MovementPort.MovementException;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * MovementController - REST adapter for the single-player movement system (Step 28).
 *
 * <ul>
 *   <li>POST /api/gameplay/&#123;uuidMatch&#125;/movements/start — move to an adjacent location</li>
 *   <li>GET  /api/match/&#123;uuidMatch&#125;/locations          — visited locations + total energy cost</li>
 * </ul>
 *
 * <p>See {@code documentation_v0/Step28_MovementSystem.md}.</p>
 */
@RestController
public class MovementController {

    private final MovementPort movementPort;

    public MovementController(MovementPort movementPort) {
        this.movementPort = movementPort;
    }

    @PostMapping("/api/gameplay/{uuidMatch}/movements/start")
    public ResponseEntity<Object> startMovement(@PathVariable String uuidMatch,
                                                @RequestBody(required = false) MovementStartRequest body,
                                                HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        String target = body == null ? null : body.getTargetLocationUuid();
        if (target == null || target.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "MISSING_TARGET", "targetLocationUuid is required");
        }
        try {
            return ResponseEntity.ok(MovementStartResponse.fromModel(
                    movementPort.startMovement(uuidMatch, userUuid, target)));
        } catch (MovementException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    @GetMapping("/api/match/{uuidMatch}/locations")
    public ResponseEntity<Object> locations(@PathVariable String uuidMatch,
                                            @RequestParam(required = false) String lang,
                                            HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        try {
            return ResponseEntity.ok(MatchLocationsResponse.fromModel(
                    uuidMatch, movementPort.listLocations(uuidMatch, userUuid, lang)));
        } catch (MovementException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    private static String userUuid(HttpServletRequest request) {
        String u = (String) request.getAttribute("userUuid");
        return (u == null || u.isBlank()) ? null : u;
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }

    private static HttpStatus mapStatus(MovementException.Code code) {
        return switch (code) {
            case MATCH_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case MATCH_NOT_RUNNING, CHARACTER_CANNOT_ACT, NOT_A_NEIGHBOR,
                 MOVEMENT_CONDITION_NOT_MET, OVERWEIGHT, INSUFFICIENT_ENERGY, LOCATION_FULL ->
                    HttpStatus.CONFLICT;
        };
    }
}
