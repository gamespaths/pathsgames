package games.paths.core.model.auth;

/**
 * GuestSession - Domain model representing a guest user session.
 * A guest is an anonymous user identified by a UUID, with a limited-time session.
 * Pure domain object with no framework dependencies.
 */
public class GuestSession {

    private final String userUuid;
    private final String username;
    private final String accessToken;
    private final String refreshToken;
    private final long accessTokenExpiresAt;
    private final long refreshTokenExpiresAt;
    private final String guestCookieToken;

    private GuestSession(Builder builder) {
        this.userUuid = builder.userUuid;
        this.username = builder.username;
        this.accessToken = builder.accessToken;
        this.refreshToken = builder.refreshToken;
        this.accessTokenExpiresAt = builder.accessTokenExpiresAt;
        this.refreshTokenExpiresAt = builder.refreshTokenExpiresAt;
        this.guestCookieToken = builder.guestCookieToken;
    }

    public String getUserUuid() {
        return userUuid;
    }

    public String getUsername() {
        return username;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public long getAccessTokenExpiresAt() {
        return accessTokenExpiresAt;
    }

    public long getRefreshTokenExpiresAt() {
        return refreshTokenExpiresAt;
    }

    public String getGuestCookieToken() {
        return guestCookieToken;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String userUuid;
        private String username;
        private String accessToken;
        private String refreshToken;
        private long accessTokenExpiresAt;
        private long refreshTokenExpiresAt;
        private String guestCookieToken;

        public Builder userUuid(String userUuid) {
            this.userUuid = userUuid;
            return this;
        }

        public Builder username(String username) {
            this.username = username;
            return this;
        }

        public Builder accessToken(String accessToken) {
            this.accessToken = accessToken;
            return this;
        }

        public Builder refreshToken(String refreshToken) {
            this.refreshToken = refreshToken;
            return this;
        }

        public Builder accessTokenExpiresAt(long accessTokenExpiresAt) {
            this.accessTokenExpiresAt = accessTokenExpiresAt;
            return this;
        }

        public Builder refreshTokenExpiresAt(long refreshTokenExpiresAt) {
            this.refreshTokenExpiresAt = refreshTokenExpiresAt;
            return this;
        }

        public Builder guestCookieToken(String guestCookieToken) {
            this.guestCookieToken = guestCookieToken;
            return this;
        }

        public GuestSession build() {
            if (userUuid == null || userUuid.isBlank()) {
                throw new IllegalStateException("userUuid is required");
            }
            if (username == null || username.isBlank()) {
                throw new IllegalStateException("username is required");
            }
            if (accessToken == null || accessToken.isBlank()) {
                throw new IllegalStateException("accessToken is required");
            }
            return new GuestSession(this);
        }
    }

    @Override
    public String toString() {
        return "GuestSession{userUuid='" + userUuid + "', username='" + username + "'}";
    }
}
