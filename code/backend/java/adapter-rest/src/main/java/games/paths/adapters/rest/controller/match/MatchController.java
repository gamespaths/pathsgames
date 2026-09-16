package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.MatchCreateRequest;
import games.paths.adapters.rest.dto.MatchInfoResponse;
import games.paths.adapters.rest.dto.MatchSummaryResponse;
import games.paths.core.model.match.MatchCreateCommand;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.port.match.MatchCommandPort;
import games.paths.core.port.match.MatchQueryPort;
import games.paths.core.service.security.CsrfTokenService;
import games.paths.core.service.security.RateLimitService;

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

    static final String RATE_BUCKET = "match";

    private final RateLimitService rateLimitService;
    private final int matchPerIp;
    private final CsrfTokenService csrfTokenService;

    public MatchController(MatchCommandPort matchCommandPort, MatchQueryPort matchQueryPort) {
        this(matchCommandPort, matchQueryPort, null, 0, null);
    }

    /** v0.37.7 — Step 41: the match bucket of the rate limiter and the CSRF check on creation. */
    @org.springframework.beans.factory.annotation.Autowired
    public MatchController(MatchCommandPort matchCommandPort, MatchQueryPort matchQueryPort,
                           RateLimitService rateLimitService,
                           @org.springframework.beans.factory.annotation.Value("${game.security.rate-limit.match-per-ip:0}") int matchPerIp,
                           CsrfTokenService csrfTokenService) {
        this.matchCommandPort = matchCommandPort;
        this.matchQueryPort = matchQueryPort;
        this.rateLimitService = rateLimitService;
        this.matchPerIp = matchPerIp;
        this.csrfTokenService = csrfTokenService;
    }

    @PostMapping("/api/matches")
    public ResponseEntity<Object> createMatch(@RequestBody(required = false) MatchCreateRequest body,
                                              HttpServletRequest request) {
        String userUuid = (String) request.getAttribute("userUuid");
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        // Step 41 — the CSRF token issued with this access token must come back as a header
        if (csrfTokenService != null && csrfTokenService.isEnforced()) {
            String presented = request.getHeader(CsrfTokenService.HEADER);
            if (presented == null || presented.isBlank()) {
                return error(HttpStatus.FORBIDDEN, "CSRF_TOKEN_MISSING",
                        CsrfTokenService.HEADER + " header is required to create a match");
            }
            if (!csrfTokenService.matches(bearerOf(request), presented)) {
                return error(HttpStatus.FORBIDDEN, "CSRF_TOKEN_INVALID",
                        CsrfTokenService.HEADER + " does not match the access token");
            }
        }
        // Step 41 — at most match-per-ip new matches per source address and window
        if (rateLimitService != null && matchPerIp > 0) {
            String ip = RateLimitService.clientIp(request.getHeader("X-Forwarded-For"),
                    request.getRemoteAddr());
            RateLimitService.Verdict verdict = rateLimitService.tryAcquire(RATE_BUCKET, ip, matchPerIp);
            if (!verdict.allowed()) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .header("Retry-After", String.valueOf(verdict.retryAfterSeconds()))
                        .body(errorBody("RATE_LIMITED", "Too many matches created from this address, retry in "
                                + verdict.retryAfterSeconds() + " seconds", verdict.retryAfterSeconds()));
            }
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
                request.getRemoteAddr(),
                body.getRngSeed());

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
                                               @RequestParam(value = "lang", defaultValue = "en") String lang,
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
        MatchDetail detail = matchQueryPort.getMatchInfo(uuidMatch, userUuid, lang);
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
        return ResponseEntity.status(status).body(errorBody(code, message, null));
    }

    private static Map<String, Object> errorBody(String code, String message, Long retryAfterSeconds) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        if (retryAfterSeconds != null) {
            body.put("retryAfterSeconds", retryAfterSeconds);
        }
        body.put("timestamp", System.currentTimeMillis());
        return body;
    }

    /** The raw bearer the filter already validated — the CSRF token is bound to it. */
    private static String bearerOf(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        return header != null && header.startsWith("Bearer ") ? header.substring(7).trim() : null;
    }

    private static HttpStatus mapStatus(MatchCommandPort.MatchCreationException.Code code) {
        return switch (code) {
            case STORY_NOT_FOUND, DIFFICULTY_NOT_FOUND, USER_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case USER_BANNED -> HttpStatus.FORBIDDEN;
            case MAINTENANCE_MODE -> HttpStatus.SERVICE_UNAVAILABLE;
            case ACTIVE_MATCH_ALREADY_EXISTS -> HttpStatus.CONFLICT;
            case STORY_HAS_NO_LOCATIONS, INVALID_INPUT, TURNSTILE_VALIDATION_FAILED,
                 TRAIT_NOT_FOUND, TRAIT_DUPLICATED,
                 TRAIT_NOT_COMPATIBLE, TRAIT_COST_EXCEEDED,
                 TRAIT_NOT_SELECTABLE -> HttpStatus.BAD_REQUEST;
        };
    }
}
