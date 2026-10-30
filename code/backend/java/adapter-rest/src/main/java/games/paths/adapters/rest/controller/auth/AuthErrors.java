package games.paths.adapters.rest.controller.auth;

import games.paths.core.model.auth.AuthException;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * AuthErrors - v1.2.0 the JSON error of an AuthException: {error, message, timestamp} with its status.
 */
final class AuthErrors {

    private AuthErrors() {
    }

    static ResponseEntity<Object> of(AuthException e) {
        ResponseEntity<Object> response = of(e.getCode().httpStatus(), e.getCode().name(), e.getMessage());
        if (e.getSuspendedUntil() != null && response.getBody() instanceof Map<?, ?> body) {
            // v1.7.0 a suspended login also names the end of the suspension
            @SuppressWarnings("unchecked")
            Map<String, Object> map = (Map<String, Object>) body;
            map.put("suspendedUntil", e.getSuspendedUntil());
        }
        return response;
    }

    static ResponseEntity<Object> of(int status, String error, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", error);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }
}
