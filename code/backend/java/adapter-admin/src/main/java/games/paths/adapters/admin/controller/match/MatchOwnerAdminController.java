package games.paths.adapters.admin.controller.match;

import games.paths.adapters.admin.controller.AdminErrors;
import games.paths.adapters.admin.dto.auth.AdminUserResponse;
import games.paths.adapters.admin.dto.match.MatchOwnerMoveResponse;
import games.paths.core.port.match.MatchOwnerPort;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * MatchOwnerAdminController - v0.41.6 admin User tab: GET the owner of a match and PUT
 * {@code {"user": "<uuid|email|username>"}} to move the match (creator and characters) to that user.
 */
@RestController
@RequestMapping("/api/admin/matches")
public class MatchOwnerAdminController {

    private final MatchOwnerPort ownerPort;
    public MatchOwnerAdminController(MatchOwnerPort ownerPort) {
        this.ownerPort = ownerPort;
    }

    @GetMapping("/{uuidMatch}/owner")
    public ResponseEntity<Object> getOwner(@PathVariable String uuidMatch) {
        try {
            return ResponseEntity.ok(AdminUserResponse.from(ownerPort.owner(uuidMatch), Instant.now()));
        } catch (MatchOwnerException ex) {
            return AdminErrors.ownerError(ex);
        }
    }

    @PutMapping("/{uuidMatch}/owner")
    public ResponseEntity<Object> moveOwner(@PathVariable String uuidMatch,
                                            @RequestBody(required = false) Map<String, Object> body) {
        Object user = body == null ? null : body.get("user");
        if (!(user instanceof String identifier) || identifier.isBlank()) {
            return AdminErrors.error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Field 'user' is required");
        }
        try {
            return ResponseEntity.ok(MatchOwnerMoveResponse.from(ownerPort.move(uuidMatch, identifier)));
        } catch (MatchOwnerException ex) {
            return AdminErrors.ownerError(ex);
        }
    }
}
