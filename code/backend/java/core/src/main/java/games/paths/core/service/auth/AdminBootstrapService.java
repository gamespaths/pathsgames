package games.paths.core.service.auth;

import games.paths.core.model.auth.AdminBootstrapResult;
import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.NewUser;
import games.paths.core.model.auth.UserStates;
import games.paths.core.model.auth.UserStatus;
import games.paths.core.port.auth.AdminBootstrapPort;
import games.paths.core.port.auth.IdentityPersistencePort;
import games.paths.core.port.auth.JwtPort;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * AdminBootstrapService - v1.2.0 a real admin user (role ADMIN, state 2) and a signed admin token;
 * the same nickname again issues a new token, never a duplicate user.
 */
public class AdminBootstrapService implements AdminBootstrapPort {

    public static final int DEFAULT_TOKEN_DAYS = 365;
    private static final Pattern NICKNAME = Pattern.compile("[A-Za-z0-9._-]{3,50}");

    private final IdentityPersistencePort identities;
    private final JwtPort jwtPort;
    private final int tokenDays;

    public AdminBootstrapService(IdentityPersistencePort identities, JwtPort jwtPort, int tokenDays) {
        this.identities = identities;
        this.jwtPort = jwtPort;
        this.tokenDays = tokenDays > 0 ? tokenDays : DEFAULT_TOKEN_DAYS;
    }

    @Override
    public AdminBootstrapResult createAdmin(String nickname) {
        String nick = nickname == null ? "" : nickname.trim();
        if (!NICKNAME.matcher(nick).matches()) {
            throw new AuthException(AuthException.Code.INVALID_REQUEST,
                    "The nickname must be 3-50 letters, digits, dots, dashes or underscores");
        }
        Optional<UserStatus> found = identities.findUserByNickname(nick);
        UserStatus admin;
        boolean created = found.isEmpty();
        if (found.isPresent()) {
            admin = found.get();
            if (!admin.isAdmin()) {
                throw new AuthException(AuthException.Code.NICKNAME_TAKEN, "The nickname belongs to a non-admin user");
            }
            UserStates.requireUsable(admin.state());
        } else {
            String uuid = UUID.randomUUID().toString();
            NewUser user = new NewUser(uuid, "admin_" + uuid.substring(0, 8), nick, null, UserStates.ROLE_ADMIN,
                    UserStates.ACTIVE, "en");
            long id = identities.createUser(user, null);
            admin = new UserStatus(id, uuid, user.username(), nick, user.role(), user.state(), "en");
        }
        Duration lifetime = Duration.ofDays(tokenDays);
        String token = jwtPort.generateAccessToken(admin.uuid(), admin.username(), UserStates.ROLE_ADMIN, lifetime);
        return new AdminBootstrapResult(admin.uuid(), admin.username(), admin.nickname(), created, token,
                Instant.now().plus(lifetime).toEpochMilli());
    }
}
