package games.paths.core.model.auth;

/**
 * GuestInfo - Domain model for guest user details visible to administrators.
 * Contains the identity, session status, and timestamps of a guest user.
 * Immutable record.
 */
public record GuestInfo(
        String userUuid,
        String username,
        String nickname,
        String role,
        int state,
        String guestCookieToken,
        String guestExpiresAt,
        String language,
        String tsRegistration,
        String tsLastAccess,
        boolean expired) {

    public GuestInfo {
        if (userUuid == null || userUuid.isBlank()) {
            throw new IllegalArgumentException("userUuid is required");
        }
        if (username == null || username.isBlank()) {
            throw new IllegalArgumentException("username is required");
        }
    }
}
