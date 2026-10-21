package games.paths.core.model.auth;

/**
 * AdminBootstrapResult - v1.2.0 the admin user created (or found again) by the bootstrap tool and
 * its signed access token; the token goes only to stdout or to the caller, never to a log.
 */
public record AdminBootstrapResult(String userUuid, String username, String nickname, boolean created,
                                   String accessToken, long expiresAt) {

    @Override
    public String toString() {
        return "AdminBootstrapResult{userUuid='" + userUuid + "', nickname='" + nickname + "'}";
    }
}
