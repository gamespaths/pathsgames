package games.paths.adapters.admin.controller;

import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;

/** AdminErrors - v0.41.6 the {error, message, timestamp} body of the owner-move endpoints. */
public final class AdminErrors {

    private AdminErrors() {
    }

    public static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }

    /** 400 for bad input, 404 for an unknown match or user, 409 for every refusal. */
    public static ResponseEntity<Object> ownerError(MatchOwnerException ex) {
        HttpStatus status = switch (ex.getCode()) {
            case INVALID_INPUT -> HttpStatus.BAD_REQUEST;
            case MATCH_NOT_FOUND, USER_NOT_FOUND -> HttpStatus.NOT_FOUND;
            default -> HttpStatus.CONFLICT;
        };
        return error(status, ex.getCode().name(), ex.getMessage());
    }
}
