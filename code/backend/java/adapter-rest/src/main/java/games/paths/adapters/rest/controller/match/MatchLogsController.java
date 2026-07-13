package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.MatchLogsResponse;
import games.paths.core.port.match.MatchLogsPort;
import games.paths.core.port.match.TurnCyclePort;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * MatchLogsController - REST adapter for the match logs endpoint (Step 28.7).
 *
 * <ul>
 *   <li>GET /api/matches/&#123;uuidMatch&#125;/logs — consolidated log timeline (owner-only)</li>
 * </ul>
 *
 * <p>Returns a chronologically-ordered list of WEATHER, MOVEMENT, SLEEP, CLOCK_ADVANCE
 * and RECOVERY events for the match. Only the match creator can access this endpoint.</p>
 *
 * <p>See {@code documentation_v0/Step28_MovementSystem.md} §8.</p>
 */
@RestController
public class MatchLogsController {

    private final MatchLogsPort matchLogsPort;

    public MatchLogsController(MatchLogsPort matchLogsPort) {
        this.matchLogsPort = matchLogsPort;
    }

    @GetMapping("/api/matches/{uuidMatch}/logs")
    public ResponseEntity<Object> getMatchLogs(@PathVariable String uuidMatch,
                                               @RequestParam(required = false) String lang,
                                               @RequestParam(required = false) Integer limit,
                                               @RequestParam(required = false) String cursor,
                                               HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        if (uuidMatch == null || uuidMatch.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid is required");
        }
        try {
            return ResponseEntity.ok(MatchLogsResponse.fromModel(
                    matchLogsPort.getMatchLogs(uuidMatch, userUuid, lang, limit, cursor)));
        } catch (TurnCyclePort.TurnCycleException ex) {
            return error(HttpStatus.NOT_FOUND, ex.getCode().name(), ex.getMessage());
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
}
