package games.paths.core.model.auth;

/**
 * TokenInfo - Immutable record representing parsed JWT token claims.
 * Used by the authentication filter and session service to carry
 * validated user identity information extracted from a JWT.
 *
 * @param userUuid  user UUID claim
 * @param username  username claim
 * @param role      role claim ({@code PLAYER} / {@code ADMIN})
 * @param type      token type — {@code "access"} or {@code "refresh"}
 * @param tokenId   JWT {@code jti} claim
 * @param issuedAt  issue time, epoch millis
 * @param expiresAt expiry time, epoch millis
 */
public record TokenInfo(
        String userUuid,
        String username,
        String role,
        String type,
        String tokenId,
        long issuedAt,
        long expiresAt) {

    public TokenInfo {
        if (userUuid == null || userUuid.isBlank()) {
            throw new IllegalStateException("userUuid is required");
        }
    }

    public boolean isAccessToken() {
        return "access".equals(type);
    }

    public boolean isRefreshToken() {
        return "refresh".equals(type);
    }

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
