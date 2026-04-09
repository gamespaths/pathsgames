package games.paths.core.model.auth;

/**
 * RefreshedSession - Immutable domain model representing the result of a token refresh.
 * Contains the new access and refresh tokens issued after a successful rotation.
 */
public class RefreshedSession {

    private final String userUuid;
    private final String username;
    private final String role;
    private final String accessToken;
    private final String refreshToken;
    private final long accessTokenExpiresAt;
    private final long refreshTokenExpiresAt;

    private RefreshedSession(Builder builder) {
        this.userUuid = builder.userUuid;
        this.username = builder.username;
        this.role = builder.role;
        this.accessToken = builder.accessToken;
        this.refreshToken = builder.refreshToken;
        this.accessTokenExpiresAt = builder.accessTokenExpiresAt;
        this.refreshTokenExpiresAt = builder.refreshTokenExpiresAt;
    }

    public String getUserUuid() {
        return userUuid;
    }

    public String getUsername() {
        return username;
    }

    public String getRole() {
        return role;
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

    @Override
    public String toString() {
        return "RefreshedSession{userUuid='" + userUuid + "', username='" + username + "'}";
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String userUuid;
        private String username;
        private String role;
        private String accessToken;
        private String refreshToken;
        private long accessTokenExpiresAt;
        private long refreshTokenExpiresAt;

        public Builder userUuid(String userUuid) {
            this.userUuid = userUuid;
            return this;
        }

        public Builder username(String username) {
            this.username = username;
            return this;
        }

        public Builder role(String role) {
            this.role = role;
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

        public RefreshedSession build() {
            if (userUuid == null || userUuid.isBlank()) {
                throw new IllegalStateException("userUuid is required");
            }
            if (accessToken == null || accessToken.isBlank()) {
                throw new IllegalStateException("accessToken is required");
            }
            return new RefreshedSession(this);
        }
    }
}
