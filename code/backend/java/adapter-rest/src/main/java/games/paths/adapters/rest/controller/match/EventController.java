package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.ExecuteEventRequest;
import games.paths.adapters.rest.dto.ExecuteEventResponse;
import games.paths.core.port.match.EventExecutionPort;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * EventController - REST adapter for normal (player-triggered) events (Step 29).
 *
 * <ul>
 *   <li>POST /api/gameplay/&#123;uuidMatch&#125;/action/execute-event — trigger a NORMAL or ONCE event</li>
 * </ul>
 *
 * <p>Whether an event can be triggered at all is already visible to the client: every event on
 * {@code GET /api/match/{uuid}/info} carries an {@code available} flag and, when false, the same
 * {@code reason} this endpoint would return as its error code.</p>
 *
 * <p>See {@code documentation_v0/Step29_NormalEvents.md}.</p>
 */
@RestController
public class EventController {

    private final EventExecutionPort eventExecutionPort;

    public EventController(EventExecutionPort eventExecutionPort) {
        this.eventExecutionPort = eventExecutionPort;
    }

    @PostMapping("/api/gameplay/{uuidMatch}/action/execute-event")
    public ResponseEntity<Object> executeEvent(@PathVariable String uuidMatch,
                                               @RequestParam(required = false) String lang,
                                               @RequestBody(required = false) ExecuteEventRequest body,
                                               HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        String eventUuid = body == null ? null : body.getEventUuid();
        if (eventUuid == null || eventUuid.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "MISSING_EVENT", "eventUuid is required");
        }
        try {
            return ResponseEntity.ok(ExecuteEventResponse.fromModel(
                    eventExecutionPort.executeEvent(uuidMatch, userUuid, eventUuid, lang)));
        } catch (EventExecutionException ex) {
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

    /** Not-found for a missing entity; conflict for a state the player could act on. */
    private static HttpStatus mapStatus(EventExecutionException.Code code) {
        return switch (code) {
            case MATCH_NOT_FOUND, EVENT_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case MATCH_NOT_RUNNING, CHARACTER_CANNOT_ACT, SLEEPING, COMA, EVENT_NOT_EXECUTABLE_TYPE,
                 ONCE_ALREADY_CONSUMED, WRONG_LOCATION, NOT_ENOUGH_ENERGY, NOT_ENOUGH_COINS,
                 REGISTRY_CONDITION_NOT_MET, WEATHER_CONDITION_NOT_MET, ITEM_CONDITION_NOT_MET,
                 CLASS_CONDITION_NOT_MET -> HttpStatus.CONFLICT;
        };
    }
}
