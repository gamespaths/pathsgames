package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.MatchMissionResponse;
import games.paths.core.model.match.MatchMission;
import games.paths.core.port.match.MatchQueryPort;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * MissionController - REST adapter for the Step 37 mission reads.
 * A mission the match has never reached is not listed at all, so it cannot be spoiled.
 */
@RestController
public class MissionController {

    private final MatchQueryPort matchQueryPort;

    public MissionController(MatchQueryPort matchQueryPort) {
        this.matchQueryPort = matchQueryPort;
    }

    @GetMapping("/api/match/{uuidMatch}/missions")
    public ResponseEntity<Object> getMissions(
            @PathVariable String uuidMatch,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "lang", defaultValue = "en") String lang,
            HttpServletRequest request) {
        ResponseEntity<Object> refused = refuse(uuidMatch, request);
        if (refused != null) {
            return refused;
        }
        List<MatchMission> missions = matchQueryPort.getMatchMissions(uuidMatch,
                userUuid(request), status, lang);
        if (missions == null) {
            return notFound();
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("missions", MatchMissionResponse.fromModel(missions));
        return ResponseEntity.ok(body);
    }

    @GetMapping("/api/match/{uuidMatch}/missions/{uuidMission}")
    public ResponseEntity<Object> getMission(
            @PathVariable String uuidMatch,
            @PathVariable String uuidMission,
            @RequestParam(value = "lang", defaultValue = "en") String lang,
            HttpServletRequest request) {
        ResponseEntity<Object> refused = refuse(uuidMatch, request);
        if (refused != null) {
            return refused;
        }
        if (uuidMission == null || uuidMission.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Mission uuid is required");
        }
        MatchMission mission = matchQueryPort.getMatchMission(uuidMatch, userUuid(request),
                uuidMission, lang);
        // A mission this match has not reached reads as not-found, like the match itself would.
        if (mission == null) {
            return notFound();
        }
        return ResponseEntity.ok(MatchMissionResponse.fromModel(mission));
    }

    private static String userUuid(HttpServletRequest request) {
        return (String) request.getAttribute("userUuid");
    }

    private static ResponseEntity<Object> refuse(String uuidMatch, HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        if (uuidMatch == null || uuidMatch.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid is required");
        }
        return null;
    }

    private static ResponseEntity<Object> notFound() {
        return error(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND", "Match not found or not accessible");
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }
}
