package games.paths.adapters.admin.controller.match;

import games.paths.adapters.rest.dto.ClockResponse;
import games.paths.adapters.rest.dto.MatchInfoResponse;
import games.paths.adapters.rest.dto.MatchLocationsResponse;
import games.paths.adapters.rest.dto.MatchSummaryResponse;
import games.paths.adapters.rest.dto.MatchUpdateRequest;
import games.paths.adapters.rest.dto.PagedMatchesResponse;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchListFilter;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.model.match.MatchSummaryPage;
import games.paths.core.port.match.CharacterCommandPort;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.port.match.MovementPort;
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
    private final CharacterCommandPort characterCommandPort;
    private final games.paths.core.service.match.WeatherSelectionService weatherService;
    private final MovementPort movementPort;

    public MatchAdminController(MatchCommandPort matchCommandPort,
                                MatchQueryPort matchQueryPort,
                                TimeAdvancementPort timeAdvancementPort,
                                CharacterCommandPort characterCommandPort,
                                games.paths.core.service.match.WeatherSelectionService weatherService,
                                MovementPort movementPort) {
        this.matchCommandPort = matchCommandPort;
        this.matchQueryPort = matchQueryPort;
        this.timeAdvancementPort = timeAdvancementPort;
        this.characterCommandPort = characterCommandPort;
        this.weatherService = weatherService;
        this.movementPort = movementPort;
    }

    /**
     * GET /api/admin/matches — paginated, filterable list of matches (v0.28.1).
     *
     * <p>Returns a {@link PagedMatchesResponse} envelope instead of a bare array,
     * so the console never reads the whole table. All query parameters are
     * optional:</p>
     * <ul>
     *   <li>{@code limit} — page size (default 50, max 200);</li>
     *   <li>{@code cursor} — opaque token from a previous {@code nextCursor};</li>
     *   <li>{@code status} — exact status filter;</li>
     *   <li>{@code userUuid} — creator filter;</li>
     *   <li>{@code storyUuid} — story filter;</li>
     *   <li>{@code sinceDays} — only matches created within the last N days.</li>
     * </ul>
     */
    @GetMapping
    public ResponseEntity<Object> listAllMatches(
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String userUuid,
            @RequestParam(required = false) String storyUuid,
            @RequestParam(required = false) Integer sinceDays) {
        MatchSummaryPage page = matchQueryPort.listMatchesPage(
                new MatchListFilter(status, userUuid, storyUuid, sinceDays, cursor, limit));
        List<MatchSummaryResponse> items = page.items().stream()
                .map(MatchSummaryResponse::fromModel)
                .collect(Collectors.toList());
        return ResponseEntity.ok(new PagedMatchesResponse(items, page.nextCursor(), page.limit()));
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
     * GET /api/admin/matches/{uuidMatch}/weather — admin weather view (Step 27):
     * the per-match rng_seed, the current weather with its delta_energy and
     * movement-cost modifiers, and the full log_weather history.
     */
    @GetMapping("/{uuidMatch}/weather")
    public ResponseEntity<Object> getAdminMatchWeather(@PathVariable String uuidMatch) {
        if (isBlank(uuidMatch)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid is required");
        }
        var view = weatherService.weatherAdmin(uuidMatch);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("rngSeed", view.rngSeed());
        body.put("current", view.current() == null ? null : weatherToMap(view.current()));
        List<Map<String, Object>> rules = view.rules().stream().map(r -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", r.id());
            row.put("uuid", r.uuid());
            row.put("idTextName", r.idTextName());
            row.put("name", r.name());
            row.put("probability", r.probability());
            row.put("deltaEnergy", r.deltaEnergy());
            row.put("costMoveSafeLocation", r.costMoveSafeLocation());
            row.put("costMoveNotSafeLocation", r.costMoveNotSafeLocation());
            row.put("active", r.active());
            row.put("current", r.current());
            return row;
        }).collect(Collectors.toList());
        body.put("rules", rules);
        List<Map<String, Object>> log = view.log().stream().map(l -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", l.id());
            row.put("uuid", l.uuid());
            row.put("clock", l.clock());
            row.put("idWeather", l.idWeather());
            row.put("weatherUuid", l.weatherUuid());
            row.put("idTextName", l.idTextName());
            row.put("timestampStart", l.timestampStart());
            return row;
        }).collect(Collectors.toList());
        body.put("log", log);
        return ResponseEntity.ok(body);
    }

    /**
     * GET /api/admin/matches/{uuidMatch}/locations — admin movement view (Step 28):
     * the visited locations of the match, each with its current character count and
     * the per-neighbor totalEnergyCost resolved for the current weather. Mirrors the
     * player endpoint GET /api/match/{uuidMatch}/locations but skips the ownership check.
     */
    @GetMapping("/{uuidMatch}/locations")
    public ResponseEntity<Object> getAdminMatchLocations(@PathVariable String uuidMatch,
                                                         @RequestParam(required = false) String lang) {
        if (isBlank(uuidMatch)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid is required");
        }
        try {
            return ResponseEntity.ok(MatchLocationsResponse.fromModel(
                    uuidMatch, movementPort.listLocationsForAdmin(uuidMatch, lang)));
        } catch (MovementPort.MovementException ex) {
            return error(HttpStatus.NOT_FOUND, ex.getCode().name(), ex.getMessage());
        }
    }

    private static Map<String, Object> weatherToMap(
            games.paths.core.port.match.WeatherStorePort.CurrentWeatherView v) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("idWeather", v.idWeather());
        m.put("uuid", v.uuid());
        m.put("idCard", v.idCard());
        m.put("idTextName", v.idTextName());
        m.put("deltaEnergy", v.deltaEnergy());
        m.put("costMoveSafeLocation", v.costMoveSafeLocation());
        m.put("costMoveNotSafeLocation", v.costMoveNotSafeLocation());
        m.put("currentClock", v.currentClock());
        return m;
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

    /**
     * POST /api/admin/matches/{uuidMatch}/player/{uuidPlayer}/changeStatistics
     * Override the current statistics of a character instance.
     * Any field set to -1 is left unchanged.
     * For energy, life, sad: the new value is capped at the character's max.
     */
    @PostMapping("/{uuidMatch}/player/{uuidPlayer}/changeStatistics")
    public ResponseEntity<Object> changeStatistics(@PathVariable String uuidMatch,
                                                   @PathVariable String uuidPlayer,
                                                   @RequestBody(required = false) ChangeStatisticsRequest body) {
        if (isBlank(uuidMatch) || isBlank(uuidPlayer)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid and player uuid are required");
        }
        CharacterCommandPort.ChangeStatsCommand command = new CharacterCommandPort.ChangeStatsCommand();
        if (body != null) {
            if (body.getDex()   != null && body.getDex()   != -1) command.setDex(body.getDex());
            if (body.getIntel() != null && body.getIntel() != -1) command.setIntel(body.getIntel());
            if (body.getCon()   != null && body.getCon()   != -1) command.setCon(body.getCon());
            if (body.getEnergy() != null && body.getEnergy() != -1) command.setEnergy(body.getEnergy());
            if (body.getLife()  != null && body.getLife()  != -1) command.setLife(body.getLife());
            if (body.getSad()   != null && body.getSad()   != -1) command.setSad(body.getSad());
            if (body.getCoin()  != null && body.getCoin()  != -1) command.setCoin(body.getCoin());
            if (body.getFood()  != null && body.getFood()  != -1) command.setFood(body.getFood());
            if (body.getMagic() != null && body.getMagic() != -1) command.setMagic(body.getMagic());
        }
        CharacterCommandPort.ChangeStatsOutcome outcome =
                characterCommandPort.changeStatistics(uuidMatch, uuidPlayer, command);
        return switch (outcome) {
            case UPDATED -> {
                Map<String, Object> responseBody = new LinkedHashMap<>();
                responseBody.put("status", "UPDATED");
                responseBody.put("matchUuid", uuidMatch);
                responseBody.put("playerUuid", uuidPlayer);
                yield ResponseEntity.ok(responseBody);
            }
            case MATCH_NOT_FOUND ->
                    error(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND", "Match not found: " + uuidMatch);
            case PLAYER_NOT_FOUND ->
                    error(HttpStatus.NOT_FOUND, "PLAYER_NOT_FOUND",
                            "Character instance not found: " + uuidPlayer);
        };
    }

    /** Request body for POST changeStatistics. Fields omitted or set to -1 are skipped. */
    public static class ChangeStatisticsRequest {
        private Integer dex;
        private Integer intel;
        private Integer con;
        private Integer energy;
        private Integer life;
        private Integer sad;
        private Integer coin;
        private Integer food;
        private Integer magic;

        public Integer getDex() { return dex; }
        public void setDex(Integer dex) { this.dex = dex; }
        public Integer getIntel() { return intel; }
        public void setIntel(Integer intel) { this.intel = intel; }
        public Integer getCon() { return con; }
        public void setCon(Integer con) { this.con = con; }
        public Integer getEnergy() { return energy; }
        public void setEnergy(Integer energy) { this.energy = energy; }
        public Integer getLife() { return life; }
        public void setLife(Integer life) { this.life = life; }
        public Integer getSad() { return sad; }
        public void setSad(Integer sad) { this.sad = sad; }
        public Integer getCoin() { return coin; }
        public void setCoin(Integer coin) { this.coin = coin; }
        public Integer getFood() { return food; }
        public void setFood(Integer food) { this.food = food; }
        public Integer getMagic() { return magic; }
        public void setMagic(Integer magic) { this.magic = magic; }
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
