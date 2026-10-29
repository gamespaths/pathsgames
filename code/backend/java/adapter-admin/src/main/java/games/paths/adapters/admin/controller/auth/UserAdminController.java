package games.paths.adapters.admin.controller.auth;

import games.paths.adapters.rest.controller.QueryLimits;
import games.paths.adapters.admin.controller.AdminErrors;
import games.paths.adapters.admin.dto.auth.AdminUserActionRequest;
import games.paths.adapters.admin.dto.auth.AdminUserItemResponse;
import games.paths.adapters.admin.dto.auth.AdminUserResponse;
import games.paths.core.model.auth.AdminUserListFilter;
import games.paths.core.model.auth.AdminUserView;
import games.paths.core.model.auth.UserAdminException;
import games.paths.core.port.auth.UserAdminPort;
import games.paths.core.port.match.MatchOwnerPort;
import games.paths.core.port.match.MatchOwnerPort.MatchOwnerException;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.function.Supplier;

/**
 * UserAdminController - v0.41.6 GET /api/admin/users/{identifier} (by uuid, email or username, with the move
 * eligibility); v1.7.0 the paged list and the ban, suspend, unblock, relink-subject and deletion actions.
 */
@RestController
@RequestMapping("/api/admin/users")
public class UserAdminController {

    private final MatchOwnerPort ownerPort;
    private final UserAdminPort userAdminPort;

    public UserAdminController(MatchOwnerPort ownerPort, UserAdminPort userAdminPort) {
        this.ownerPort = ownerPort;
        this.userAdminPort = userAdminPort;
    }

    @GetMapping
    public ResponseEntity<Object> listUsers(@RequestParam(required = false) String email,
                                            @RequestParam(required = false) String nickname,
                                            @RequestParam(required = false) String state,
                                            @RequestParam(required = false) String cursor,
                                            @RequestParam(required = false) String limit) {
        return run(() -> AdminUserItemResponse.Page.of(
                userAdminPort.list(new AdminUserListFilter(email, nickname, state, cursor, QueryLimits.parse(limit)))));
    }

    @GetMapping("/{identifier}")
    public ResponseEntity<Object> getUser(@PathVariable String identifier) {
        try {
            AdminUserView user = ownerPort.findUser(identifier);
            return ResponseEntity.ok(AdminUserResponse.from(user, Instant.now(), userAdminPort.detail(user.uuid())));
        } catch (MatchOwnerException ex) {
            return AdminErrors.ownerError(ex);
        }
    }

    @PostMapping("/{uuid}/ban")
    public ResponseEntity<Object> ban(@PathVariable String uuid, @RequestBody(required = false) AdminUserActionRequest body,
                                      @RequestAttribute(value = "userUuid", required = false) String adminUuid) {
        return run(() -> userAdminPort.ban(adminUuid, uuid, reason(body)));
    }

    @PostMapping("/{uuid}/suspend")
    public ResponseEntity<Object> suspend(@PathVariable String uuid,
                                          @RequestBody(required = false) AdminUserActionRequest body,
                                          @RequestAttribute(value = "userUuid", required = false) String adminUuid) {
        return run(() -> userAdminPort.suspend(adminUuid, uuid, body == null ? null : body.until(), reason(body)));
    }

    @PostMapping("/{uuid}/unblock")
    public ResponseEntity<Object> unblock(@PathVariable String uuid,
                                          @RequestBody(required = false) AdminUserActionRequest body,
                                          @RequestAttribute(value = "userUuid", required = false) String adminUuid) {
        return run(() -> userAdminPort.unblock(adminUuid, uuid, reason(body)));
    }

    @PostMapping("/{uuid}/relink-subject")
    public ResponseEntity<Object> relinkSubject(@PathVariable String uuid,
                                                @RequestBody(required = false) AdminUserActionRequest body,
                                                @RequestAttribute(value = "userUuid", required = false) String adminUuid) {
        return run(() -> userAdminPort.relinkSubject(adminUuid, uuid, reason(body)));
    }

    @PostMapping("/{uuid}/deletion")
    public ResponseEntity<Object> deletion(@PathVariable String uuid,
                                           @RequestBody(required = false) AdminUserActionRequest body,
                                           @RequestAttribute(value = "userUuid", required = false) String adminUuid) {
        return run(() -> userAdminPort.deleteUser(adminUuid, uuid, reason(body)));
    }

    private static String reason(AdminUserActionRequest body) {
        return body == null ? null : body.reason();
    }

    private static ResponseEntity<Object> run(Supplier<Object> action) {
        try {
            return ResponseEntity.ok(action.get());
        } catch (UserAdminException ex) {
            return AdminErrors.error(HttpStatus.valueOf(ex.getCode().httpStatus()), ex.getCode().name(),
                    ex.getMessage());
        }
    }
}
