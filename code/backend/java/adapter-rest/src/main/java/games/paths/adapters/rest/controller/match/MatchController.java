package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.MatchCreateRequest;
import games.paths.adapters.rest.dto.MatchInfoResponse;
import games.paths.adapters.rest.dto.MatchSummaryResponse;
import games.paths.adapters.rest.dto.MatchUpdateRequest;
import games.paths.core.model.match.MatchCreateCommand;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchStatuses;
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

    /**
     * GET /api/admin/matches — lists every match in the platform (admin view).
     * The admin role is enforced by {@code JwtAuthenticationFilter} for any
     * path under {@code /api/admin/}.
     */
    @GetMapping("/api/admin/matches")
    public ResponseEntity<Object> listAllMatches() {
        List<MatchSummary> models = matchQueryPort.listAllMatches();
        List<MatchSummaryResponse> result = models.stream()
                .map(MatchSummaryResponse::fromModel)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/admin/matches/statuses — the valid match statuses, each flagged
     * {@code terminal} when a match in that status is "stopped" (deletable).
     */
    @GetMapping("/api/admin/matches/statuses")
    public ResponseEntity<Object> listMatchStatuses() {
        List<Map<String, Object>> result = MatchStatuses.ALL.stream()
                .map(status -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("value", status);
                    entry.put("terminal", MatchStatuses.isTerminal(status));
                    return entry;
                })
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    /**
     * GET /api/admin/matches/{uuidMatch}/info — full match detail (summary +
     * runtime state) for the admin console, without the per-user ownership
     * check enforced by GET /api/match/{uuidMatch}/info.
     */
    @GetMapping("/api/admin/matches/{uuidMatch}/info")
    public ResponseEntity<Object> getAdminMatchInfo(@PathVariable String uuidMatch) {
        if (isBlank(uuidMatch)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid is required");
        }
        MatchDetail detail = matchQueryPort.getMatchInfoForAdmin(uuidMatch);
        if (detail == null) {
            return error(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND", "Match not found: " + uuidMatch);
        }
        return ResponseEntity.ok(MatchInfoResponse.fromModel(detail));
    }

    /**
     * PUT /api/admin/matches/{uuidMatch} — admin update of a match's status
     * and/or name. At least one field must be provided.
     */
    @PutMapping("/api/admin/matches/{uuidMatch}")
    public ResponseEntity<Object> updateMatch(@PathVariable String uuidMatch,
                                              @RequestBody(required = false) MatchUpdateRequest body) {
        String status = body != null ? body.getStatus() : null;
        String name   = body != null ? body.getName()   : null;
        if (status == null && name == null) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "At least one of status or name must be provided");
        }
        return applyMatchUpdate(uuidMatch, status, name);
    }

    /** POST /api/admin/matches/{uuidMatch}/stop — sets the match status to ENDED. */
    @PostMapping("/api/admin/matches/{uuidMatch}/stop")
    public ResponseEntity<Object> stopMatch(@PathVariable String uuidMatch) {
        return applyMatchUpdate(uuidMatch, MatchStatuses.ENDED, null);
    }

    /** POST /api/admin/matches/{uuidMatch}/pause — sets the match status to PAUSED. */
    @PostMapping("/api/admin/matches/{uuidMatch}/pause")
    public ResponseEntity<Object> pauseMatch(@PathVariable String uuidMatch) {
        return applyMatchUpdate(uuidMatch, MatchStatuses.PAUSED, null);
    }

    /** POST /api/admin/matches/{uuidMatch}/resume — sets the match status to RUNNING. */
    @PostMapping("/api/admin/matches/{uuidMatch}/resume")
    public ResponseEntity<Object> resumeMatch(@PathVariable String uuidMatch) {
        return applyMatchUpdate(uuidMatch, MatchStatuses.RUNNING, null);
    }

    /**
     * DELETE /api/admin/matches/{uuidMatch} — deletes a match. Only matches in
     * a terminal status (ENDED / GAMEOVER) may be deleted.
     */
    @DeleteMapping("/api/admin/matches/{uuidMatch}")
    public ResponseEntity<Object> deleteMatch(@PathVariable String uuidMatch) {
        MatchCommandPort.DeleteOutcome outcome = matchCommandPort.deleteMatch(uuidMatch);
        switch (outcome) {
            case DELETED:
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("status", "DELETED");
                body.put("uuid", uuidMatch);
                return ResponseEntity.ok(body);
            case NOT_STOPPED:
                return error(HttpStatus.CONFLICT, "MATCH_NOT_STOPPED",
                        "Only stopped matches (ENDED or GAMEOVER) can be deleted");
            case NOT_FOUND:
            default:
                return error(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND",
                        "Match not found: " + uuidMatch);
        }
    }

    private ResponseEntity<Object> applyMatchUpdate(String uuidMatch, String status, String name) {
        MatchCommandPort.UpdateOutcome outcome = matchCommandPort.updateMatch(uuidMatch, status, name);
        switch (outcome) {
            case UPDATED:
                Map<String, Object> body = new LinkedHashMap<>();
                body.put("status", "UPDATED");
                body.put("uuid", uuidMatch);
                return ResponseEntity.ok(body);
            case INVALID_STATUS:
                return error(HttpStatus.BAD_REQUEST, "INVALID_STATUS",
                        "status must be one of " + MatchStatuses.ALL);
            case NOT_FOUND:
            default:
                return error(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND",
                        "Match not found: " + uuidMatch);
        }
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
