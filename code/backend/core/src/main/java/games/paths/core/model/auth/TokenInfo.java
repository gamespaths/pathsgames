package games.paths.core.model.auth;

/**
 * TokenInfo - Immutable domain model representing parsed JWT token claims.
 * Used by the authentication filter and session service to carry
 * validated user identity information extracted from a JWT.
 */
public class TokenInfo {

    private final String userUuid;
    private final String username;
    private final String role;
    private final String type;       // "access" or "refresh"
    private final String tokenId;    // JWT jti claim
    private final long issuedAt;     // epoch millis
    private final long expiresAt;    // epoch millis

    private TokenInfo(Builder builder) {
        this.userUuid = builder.userUuid;
        this.username = builder.username;
        this.role = builder.role;
        this.type = builder.type;
        this.tokenId = builder.tokenId;
        this.issuedAt = builder.issuedAt;
        this.expiresAt = builder.expiresAt;
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

    public String getType() {
        return type;
    }

    public String getTokenId() {
        return tokenId;
    }

    public long getIssuedAt() {
        return issuedAt;
    }

    public long getExpiresAt() {
        return expiresAt;
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

    @Override
    public String toString() {
        return "TokenInfo{userUuid='" + userUuid + "', username='" + username +
                "', role='" + role + "', type='" + type + "'}";
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder {
        private String userUuid;
        private String username;
        private String role;
        private String type;
        private String tokenId;
        private long issuedAt;
        private long expiresAt;

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

        public Builder type(String type) {
            this.type = type;
            return this;
        }

        public Builder tokenId(String tokenId) {
            this.tokenId = tokenId;
            return this;
        }

        public Builder issuedAt(long issuedAt) {
            this.issuedAt = issuedAt;
            return this;
        }

        public Builder expiresAt(long expiresAt) {
            this.expiresAt = expiresAt;
            return this;
        }

        public TokenInfo build() {
            if (userUuid == null || userUuid.isBlank()) {
                throw new IllegalStateException("userUuid is required");
            }
            return new TokenInfo(this);
        }
    }
}
