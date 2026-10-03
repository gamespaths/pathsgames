package games.paths.adapters.admin.controller.auth;

import games.paths.adapters.admin.controller.AdminErrors;
import games.paths.adapters.admin.dto.auth.AdminUserResponse;
import games.paths.core.port.match.MatchOwnerPort;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/**
 * UserAdminController - v0.41.6 GET /api/admin/users/{identifier}: one user by uuid, email or
 * username (the owner-move preview), with its eligibility; 404 USER_NOT_FOUND, 409 USER_AMBIGUOUS.
 */
@RestController
@RequestMapping("/api/admin/users")
public class UserAdminController {

    private final MatchOwnerPort ownerPort;
    public UserAdminController(MatchOwnerPort ownerPort) {
        this.ownerPort = ownerPort;
    }

    @GetMapping("/{identifier}")
    public ResponseEntity<Object> getUser(@PathVariable String identifier) {
        try {
            return ResponseEntity.ok(AdminUserResponse.from(ownerPort.findUser(identifier), Instant.now()));
        } catch (MatchOwnerException ex) {
            return AdminErrors.ownerError(ex);
        }
    }
}
