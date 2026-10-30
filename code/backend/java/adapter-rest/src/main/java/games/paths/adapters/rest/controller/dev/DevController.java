package games.paths.adapters.rest.controller.dev;

import games.paths.core.model.dev.CleanupResult;
import games.paths.core.model.auth.AdminBootstrapResult;
import games.paths.core.model.auth.AdminUserActionResult;
import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.UserAdminException;
import games.paths.core.port.auth.AccountPort;
import games.paths.core.port.auth.AdminBootstrapPort;
import games.paths.core.port.auth.UserAdminPort;
import games.paths.core.port.dev.FakeGoogleTokenPort;
import games.paths.core.port.dev.TestDataCleanupPort;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * DevController - REST adapter for dev-only maintenance endpoints.
 *
 * <p>POST /api/dev/cleanup → removes the rows created by automated (Robot
 * Framework) test runs — guests and matches carrying the {@code robottest}
 * marker — while preserving every other row.</p>
 *
 * <p>The endpoint returns 403 unless {@code game.dev.test-endpoints-enabled}
 * is {@code true}, so it is inert in production deployments (the prod profile
 * sets it to {@code false}).</p>
 */
@RestController
@RequestMapping("/api/dev")
public class DevController {

    /** v1.2.0 the admin nickname Robot uses when the request names none (not a robottest one). */
    static final String DEFAULT_ADMIN_NICKNAME = "robot_admin";

    private final TestDataCleanupPort testDataCleanupPort;
    private final boolean testEndpointsEnabled;
    private final AdminBootstrapPort adminBootstrapPort;
    private final FakeGoogleTokenPort fakeGoogleTokenPort;
    private final AccountPort accountPort;
    private final UserAdminPort userAdminPort;

    public DevController(TestDataCleanupPort testDataCleanupPort, boolean testEndpointsEnabled) {
        this(testDataCleanupPort, testEndpointsEnabled, null, null, null, null);
    }

    public DevController(TestDataCleanupPort testDataCleanupPort, boolean testEndpointsEnabled,
                         AdminBootstrapPort adminBootstrapPort, FakeGoogleTokenPort fakeGoogleTokenPort,
                         AccountPort accountPort) {
        this(testDataCleanupPort, testEndpointsEnabled, adminBootstrapPort, fakeGoogleTokenPort, accountPort, null);
    }

    /** v1.2.0 Robot's admin token, the fake Google provider and the account jobs; v1.10.0 suspension end. */
    @org.springframework.beans.factory.annotation.Autowired
    public DevController(TestDataCleanupPort testDataCleanupPort,
                         @Value("${game.dev.test-endpoints-enabled:false}") boolean testEndpointsEnabled,
                         AdminBootstrapPort adminBootstrapPort, FakeGoogleTokenPort fakeGoogleTokenPort,
                         AccountPort accountPort, UserAdminPort userAdminPort) {
        this.testDataCleanupPort = testDataCleanupPort;
        this.testEndpointsEnabled = testEndpointsEnabled;
        this.adminBootstrapPort = adminBootstrapPort;
        this.fakeGoogleTokenPort = fakeGoogleTokenPort;
        this.accountPort = accountPort;
        this.userAdminPort = userAdminPort;
    }

    /**
     * POST /api/dev/cleanup
     * Deletes all guests and matches created by automated test runs.
     */
    @PostMapping("/cleanup")
    public ResponseEntity<Object> cleanup() {
        if (!testEndpointsEnabled) {
            return disabled();
        }

        CleanupResult result = testDataCleanupPort.cleanupTestData();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("deletedGuests", result.deletedGuests());
        body.put("deletedMatches", result.deletedMatches());
        body.put("deletedUsers", result.deletedUsers());
        return ResponseEntity.ok(body);
    }

    /** POST /api/dev/admin-token {nickname?} - v1.2.0 a real admin user and its token, for Robot. */
    @PostMapping("/admin-token")
    public ResponseEntity<Object> adminToken(@RequestBody(required = false) Map<String, Object> request) {
        if (!testEndpointsEnabled || adminBootstrapPort == null) {
            return disabled();
        }
        Object nick = request == null ? null : request.get("nickname");
        try {
            AdminBootstrapResult admin = adminBootstrapPort.createAdmin(
                    nick instanceof String n && !n.isBlank() ? n : DEFAULT_ADMIN_NICKNAME);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("userUuid", admin.userUuid());
            body.put("username", admin.username());
            body.put("nickname", admin.nickname());
            body.put("role", "ADMIN");
            body.put("created", admin.created());
            body.put("accessToken", admin.accessToken());
            body.put("expiresAt", admin.expiresAt());
            return ResponseEntity.status(HttpStatus.CREATED).body(body);
        } catch (AuthException e) {
            return error(HttpStatus.valueOf(e.getCode().httpStatus()), e.getCode().name(), e.getMessage());
        }
    }

    /** POST /api/dev/google-token {claims} - v1.2.0 an ID token of the fake Google provider. */
    @PostMapping("/google-token")
    public ResponseEntity<Object> googleToken(@RequestBody(required = false) Map<String, Object> claims) {
        if (!testEndpointsEnabled || fakeGoogleTokenPort == null || !fakeGoogleTokenPort.isEnabled()) {
            return disabled();
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("idToken", fakeGoogleTokenPort.mint(claims));
        return ResponseEntity.ok(body);
    }

    /** POST /api/dev/jobs/account-deletion - v1.2.0 runs the deletion job now (Robot). */
    @PostMapping("/jobs/account-deletion")
    public ResponseEntity<Object> runAccountDeletion() {
        if (!testEndpointsEnabled || accountPort == null) {
            return disabled();
        }
        return ResponseEntity.ok(Map.of("deletedUsers", accountPort.runDeletionJob()));
    }

    /** POST /api/dev/users/{uuid}/expire-suspension - v1.10.0 the suspension ends now (Robot auto-unblock). */
    @PostMapping("/users/{userUuid}/expire-suspension")
    public ResponseEntity<Object> expireSuspension(@PathVariable String userUuid) {
        if (!testEndpointsEnabled || userAdminPort == null) {
            return disabled();
        }
        try {
            AdminUserActionResult result = userAdminPort.expireSuspension(userUuid);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("userUuid", result.uuid());
            body.put("state", result.state());
            body.put("suspendedUntil", result.suspendedUntil());
            return ResponseEntity.ok(body);
        } catch (UserAdminException e) {
            return error(HttpStatus.valueOf(e.getCode().httpStatus()), e.getCode().name(), e.getMessage());
        }
    }

    private static ResponseEntity<Object> disabled() {
        return error(HttpStatus.FORBIDDEN, "DEV_ENDPOINTS_DISABLED", "Dev test endpoints are disabled on this environment");
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, String> error = new LinkedHashMap<>();
        error.put("error", code);
        error.put("message", message);
        return ResponseEntity.status(status).body(error);
    }
}
