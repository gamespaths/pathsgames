package games.paths.adapters.admin.controller.match;

import games.paths.adapters.rest.dto.ClockResponse;
import games.paths.adapters.rest.dto.MatchInfoResponse;
import games.paths.adapters.rest.dto.MatchSummaryResponse;
import games.paths.adapters.rest.dto.MatchUpdateRequest;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.port.match.TimeAdvancementPort;
import games.paths.core.port.match.TurnCyclePort;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * MatchAdminController - Admin REST controller for platform-wide match management.
 *
 * <p>Extracted from {@code MatchController} (Step 20.x) so that every {@code /api/admin/**}
 * endpoint lives in the dedicated {@code adapter-admin} module and is served on the
 * admin-only port (default 8044). Player match endpoints stay in {@code MatchController}
 * on the public port.</p>
 *
 * <p>All endpoints require ADMIN role (enforced by {@code JwtAuthenticationFilter} on
 * {@code /api/admin/**}) and are reachable only on the admin connector
 * (enforced by {@code AdminPortFilter}).</p>
 */
@RestController
@RequestMapping("/api/admin/matches")
public class MatchAdminController {

    private final MatchCommandPort matchCommandPort;
    private final MatchQueryPort matchQueryPort;
    private final TimeAdvancementPort timeAdvancementPort;

    public MatchAdminController(MatchCommandPort matchCommandPort,
                                MatchQueryPort matchQueryPort,
                                TimeAdvancementPort timeAdvancementPort) {
        this.matchCommandPort = matchCommandPort;
        this.matchQueryPort = matchQueryPort;
        this.timeAdvancementPort = timeAdvancementPort;
    }

    /** GET /api/admin/matches — lists every match in the platform (admin view). */
    @GetMapping
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
    @GetMapping("/statuses")
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
    @GetMapping("/{uuidMatch}/info")
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
     * GET /api/admin/matches/{uuidMatch}/clock — admin-scoped read of the clock
     * cycle (Step 26): current clock, story labels and per-character sleeping/energy
     * state. Mirrors the player endpoint GET /api/match/{uuidMatch}/clock but skips
     * the participant ownership check so the admin console can inspect any match.
     */
    @GetMapping("/{uuidMatch}/clock")
    public ResponseEntity<Object> getAdminMatchClock(@PathVariable String uuidMatch) {
        if (isBlank(uuidMatch)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid is required");
        }
        try {
            return ResponseEntity.ok(ClockResponse.fromModel(
                    timeAdvancementPort.clockForAdmin(uuidMatch)));
        } catch (TurnCyclePort.TurnCycleException ex) {
            return error(HttpStatus.NOT_FOUND, ex.getCode().name(), ex.getMessage());
        }
    }

    /**
     * PUT /api/admin/matches/{uuidMatch} — admin update of a match's status
     * and/or name. At least one field must be provided.
     */
    @PutMapping("/{uuidMatch}")
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
    @PostMapping("/{uuidMatch}/stop")
    public ResponseEntity<Object> stopMatch(@PathVariable String uuidMatch) {
        return applyMatchUpdate(uuidMatch, MatchStatuses.ENDED, null);
    }

    /** POST /api/admin/matches/{uuidMatch}/pause — sets the match status to PAUSED. */
    @PostMapping("/{uuidMatch}/pause")
    public ResponseEntity<Object> pauseMatch(@PathVariable String uuidMatch) {
        return applyMatchUpdate(uuidMatch, MatchStatuses.PAUSED, null);
    }

    /** POST /api/admin/matches/{uuidMatch}/resume — sets the match status to RUNNING. */
    @PostMapping("/{uuidMatch}/resume")
    public ResponseEntity<Object> resumeMatch(@PathVariable String uuidMatch) {
        return applyMatchUpdate(uuidMatch, MatchStatuses.RUNNING, null);
    }

    /**
     * DELETE /api/admin/matches/{uuidMatch} — deletes a match. Only matches in
     * a terminal status (ENDED / GAMEOVER) may be deleted.
     */
    @DeleteMapping("/{uuidMatch}")
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
}
