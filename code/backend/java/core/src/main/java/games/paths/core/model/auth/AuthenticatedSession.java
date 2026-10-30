package games.paths.core.model.auth;

import java.util.List;

/**
 * AuthenticatedSession - v1.2.0 the outcome of a Google login: the token pair, the profile and
 * what the guest merge did (merged guest uuid or null, matches set to CANCELLED and their uuids).
 */
public record AuthenticatedSession(UserProfile profile, String accessToken, String refreshToken,
                                   long accessTokenExpiresAt, long refreshTokenExpiresAt, boolean newUser,
                                   String mergedGuestUuid, int cancelledMatches, List<String> cancelledMatchUuids) {

    public AuthenticatedSession {
        cancelledMatchUuids = cancelledMatchUuids != null ? List.copyOf(cancelledMatchUuids) : List.of();
    }

    public AuthenticatedSession(UserProfile profile, String accessToken, String refreshToken,
                                long accessTokenExpiresAt, long refreshTokenExpiresAt, boolean newUser,
                                String mergedGuestUuid, int cancelledMatches) {
        this(profile, accessToken, refreshToken, accessTokenExpiresAt, refreshTokenExpiresAt, newUser,
                mergedGuestUuid, cancelledMatches, List.of());
    }

    @Override
    public String toString() {
        return "AuthenticatedSession{profile=" + profile + ", newUser=" + newUser + "}";
    }
}
