package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.ClockResponse;
import games.paths.adapters.rest.dto.SleepActionResponse;
import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.TurnCyclePort;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * TimeClockController - REST adapter for time advancement & clock cycle (Step 25).
 *
 * <ul>
 *   <li>POST /api/gameplay/&#123;uuidMatch&#125;/action/sleep — voluntary sleep + time-end</li>
 *   <li>GET  /api/match/&#123;uuidMatch&#125;/clock            — read clock / sleeping state</li>
 * </ul>
 *
 * <p>See {@code documentation_v0/Step25_TimeAdvancementClockCycle.md}.</p>
 */
@RestController
public class TimeClockController {

    private final TimeAdvancementPort timeAdvancementPort;

    public TimeClockController(TimeAdvancementPort timeAdvancementPort) {
        this.timeAdvancementPort = timeAdvancementPort;
    }

    @PostMapping("/api/gameplay/{uuidMatch}/action/sleep")
    public ResponseEntity<Object> sleep(@PathVariable String uuidMatch, HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        try {
            return ResponseEntity.ok(SleepActionResponse.fromModel(
                    timeAdvancementPort.sleep(uuidMatch, userUuid)));
        } catch (TurnCyclePort.TurnCycleException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    @GetMapping("/api/match/{uuidMatch}/clock")
    public ResponseEntity<Object> clock(@PathVariable String uuidMatch, HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        try {
            return ResponseEntity.ok(ClockResponse.fromModel(
                    timeAdvancementPort.clock(uuidMatch, userUuid)));
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
