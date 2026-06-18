package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.PassTurnResponse;
import games.paths.adapters.rest.dto.TurnSequenceResponse;
import games.paths.core.port.match.TurnCyclePort;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * TurnCycleController - REST adapter for the single-player turn cycle (Step 24).
 *
 * <ul>
 *   <li>POST /api/matches/&#123;uuidMatch&#125;/start          — CREATED → RUNNING + build queue</li>
 *   <li>POST /api/gameplay/&#123;uuidMatch&#125;/action/pass   — voluntary turn pass</li>
 *   <li>GET  /api/match/&#123;uuidMatch&#125;/turn-sequence    — read the turn queue</li>
 * </ul>
 *
 * <p>See {@code documentation_v0/Step24_TurnCycleEngine.md}.</p>
 */
@RestController
public class TurnCycleController {

    private final TurnCyclePort turnCyclePort;

    public TurnCycleController(TurnCyclePort turnCyclePort) {
        this.turnCyclePort = turnCyclePort;
    }

    @PostMapping("/api/matches/{uuidMatch}/start")
    public ResponseEntity<Object> start(@PathVariable String uuidMatch, HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        try {
            return ResponseEntity.ok(TurnSequenceResponse.fromModel(
                    turnCyclePort.startMatch(uuidMatch, userUuid)));
        } catch (TurnCyclePort.TurnCycleException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    @PostMapping("/api/gameplay/{uuidMatch}/action/pass")
    public ResponseEntity<Object> pass(@PathVariable String uuidMatch, HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        try {
            return ResponseEntity.ok(PassTurnResponse.fromModel(
                    turnCyclePort.passTurn(uuidMatch, userUuid)));
        } catch (TurnCyclePort.TurnCycleException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    @GetMapping("/api/match/{uuidMatch}/turn-sequence")
    public ResponseEntity<Object> sequence(@PathVariable String uuidMatch, HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        try {
            return ResponseEntity.ok(TurnSequenceResponse.fromModel(
                    turnCyclePort.getTurnSequence(uuidMatch, userUuid)));
        } catch (TurnCyclePort.TurnCycleException ex) {
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

    private static HttpStatus mapStatus(TurnCyclePort.TurnCycleException.Code code) {
        return switch (code) {
            case MATCH_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case MATCH_NOT_STARTABLE, NO_CHARACTERS_JOINED, MATCH_NOT_RUNNING, NOT_YOUR_TURN ->
                    HttpStatus.CONFLICT;
        };
    }
}
