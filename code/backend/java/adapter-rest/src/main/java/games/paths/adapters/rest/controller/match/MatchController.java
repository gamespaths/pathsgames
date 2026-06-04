package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.MatchCreateRequest;
import games.paths.adapters.rest.dto.MatchInfoResponse;
import games.paths.adapters.rest.dto.MatchSummaryResponse;
import games.paths.core.model.match.MatchCreateCommand;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchQueryPort;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MatchController - REST adapter for single-player match operations.
 *
 * <ul>
 *   <li>POST /api/matches              — create a new match</li>
 *   <li>GET  /api/matches              — list current user matches</li>
 *   <li>GET  /api/match/&#123;uuid&#125;/info  — match details (state + registry)</li>
 * </ul>
 *
 * <p>Step 19 — see {@code documentation_v0/Step19_SinglePlayerMatchCreation.md}.</p>
 */
@RestController
public class MatchController {

    private final MatchCommandPort matchCommandPort;
    private final MatchQueryPort matchQueryPort;

    public MatchController(MatchCommandPort matchCommandPort, MatchQueryPort matchQueryPort) {
        this.matchCommandPort = matchCommandPort;
        this.matchQueryPort = matchQueryPort;
    }

    @PostMapping("/api/matches")
    public ResponseEntity<Object> createMatch(@RequestBody(required = false) MatchCreateRequest body,
                                              HttpServletRequest request) {
        String userUuid = (String) request.getAttribute("userUuid");
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        if (body == null || isBlank(body.getStoryUuid()) || isBlank(body.getDifficultyUuid())) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "storyUuid and difficultyUuid are required");
        }

        MatchCreateCommand command = new MatchCreateCommand(
                userUuid,
                body.getStoryUuid(),
                body.getDifficultyUuid(),
                body.getName(),
                body.getCharacterTemplateUuid(),
                body.getClassUuid(),
                body.getTraitUuids(),
                body.getSinglePlayer(),
                body.getTurnstileToken(),
                request.getRemoteAddr());

        try {
            MatchSummary created = matchCommandPort.createMatch(command);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(MatchSummaryResponse.fromModel(created));
        } catch (MatchCommandPort.MatchCreationException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    @GetMapping("/api/matches")
    public ResponseEntity<Object> listMatches(HttpServletRequest request) {
        String userUuid = (String) request.getAttribute("userUuid");
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        List<MatchSummary> models = matchQueryPort.listUserMatches(userUuid);
        List<MatchSummaryResponse> result = models.stream()
                .map(MatchSummaryResponse::fromModel)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/api/match/{uuidMatch}/info")
    public ResponseEntity<Object> getMatchInfo(@PathVariable String uuidMatch,
                                               HttpServletRequest request) {
        String userUuid = (String) request.getAttribute("userUuid");
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        if (isBlank(uuidMatch)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Match uuid is required");
        }
        MatchDetail detail = matchQueryPort.getMatchInfo(uuidMatch, userUuid);
        if (detail == null) {
            return error(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND",
                    "Match not found or not accessible");
        }
        return ResponseEntity.ok(MatchInfoResponse.fromModel(detail));
    }

    /**
     * PATCH /api/match/{uuidMatch}/end/{uuidEvent} — Step 20.1.
     * Completes a match (sets status to ENDED) when the supplied event uuid is
     * the story's end-game event. Returns 406 Not Acceptable when the event is
     * not the configured end-game trigger. The idEventEndGame value is never
     * exposed in any response payload.
     */
    @PatchMapping("/api/match/{uuidMatch}/end/{uuidEvent}")
    public ResponseEntity<Object> endMatch(@PathVariable String uuidMatch,
                                           @PathVariable String uuidEvent,
                                           HttpServletRequest request) {
        String userUuid = (String) request.getAttribute("userUuid");
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        if (isBlank(uuidMatch) || isBlank(uuidEvent)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Match uuid and event uuid are required");
        }
        MatchCommandPort.EndMatchOutcome outcome =
                matchCommandPort.endMatch(uuidMatch, uuidEvent, userUuid);
        switch (outcome) {
            case COMPLETED:
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("status", "ENDED");
                body.put("uuid", uuidMatch);
                return ResponseEntity.ok(body);
            case NOT_ACCEPTABLE:
                return error(HttpStatus.NOT_ACCEPTABLE, "EVENT_NOT_END_GAME",
                        "The supplied event is not the end-game event for this match");
            case NOT_FOUND:
            default:
                return error(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND",
                        "Match not found or not accessible");
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }

    private static HttpStatus mapStatus(MatchCommandPort.MatchCreationException.Code code) {
        return switch (code) {
            case STORY_NOT_FOUND, DIFFICULTY_NOT_FOUND, USER_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case USER_BANNED -> HttpStatus.FORBIDDEN;
            case MAINTENANCE_MODE -> HttpStatus.SERVICE_UNAVAILABLE;
            case STORY_HAS_NO_LOCATIONS, INVALID_INPUT, TURNSTILE_VALIDATION_FAILED -> HttpStatus.BAD_REQUEST;
        };
    }
}
