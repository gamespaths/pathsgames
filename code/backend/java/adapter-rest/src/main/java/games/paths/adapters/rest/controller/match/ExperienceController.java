package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.UseExpRequest;
import games.paths.adapters.rest.dto.UseExpResponse;
import games.paths.core.port.match.ExperiencePort;
import games.paths.core.port.match.ExperiencePort.ExperienceException;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * ExperienceController - REST adapter of Step 38: POST /api/gameplay/{uuidMatch}/action/use-exp
 * spends experience on a +1 of dex / int / cos. Body {@code {"stat": "dex"}}.
 */
@RestController
public class ExperienceController {

    private final ExperiencePort experiencePort;

    public ExperienceController(ExperiencePort experiencePort) {
        this.experiencePort = experiencePort;
    }

    @PostMapping("/api/gameplay/{uuidMatch}/action/use-exp")
    public ResponseEntity<Object> useExp(@PathVariable String uuidMatch,
                                         @RequestBody(required = false) UseExpRequest body,
                                         HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        String stat = body != null ? body.getStat() : null;
        if (stat == null || stat.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_STAT", "stat is required: one of dex, int, cos");
        }
        try {
            return ResponseEntity.ok(UseExpResponse.fromModel(experiencePort.useExp(uuidMatch, userUuid, stat)));
        } catch (ExperienceException ex) {
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

    /** Not-found for a missing entity, bad-request for a wrong body, conflict for a state the player could act on. */
    static HttpStatus mapStatus(ExperienceException.Code code) {
        return switch (code) {
            case MATCH_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case INVALID_STAT -> HttpStatus.BAD_REQUEST;
            case MATCH_NOT_RUNNING, NOT_YOUR_TURN, COMA, SLEEPING, LOCATION_NOT_SAFE,
                 MAX_STAT_VALUE, NOT_ENOUGH_EXP -> HttpStatus.CONFLICT;
        };
    }
}
