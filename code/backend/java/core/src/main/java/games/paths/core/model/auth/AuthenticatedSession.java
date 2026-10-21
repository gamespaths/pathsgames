package games.paths.core.model.auth;

/**
 * AuthenticatedSession - v1.2.0 the outcome of a Google login: the token pair, the profile and
 * what the guest merge did (merged guest uuid or null, matches set to CANCELLED).
 */
public record AuthenticatedSession(UserProfile profile, String accessToken, String refreshToken,
                                   long accessTokenExpiresAt, long refreshTokenExpiresAt, boolean newUser,
                                   String mergedGuestUuid, int cancelledMatches) {

    @Override
    public String toString() {
        return "AuthenticatedSession{profile=" + profile + ", newUser=" + newUser + "}";
    }
}
