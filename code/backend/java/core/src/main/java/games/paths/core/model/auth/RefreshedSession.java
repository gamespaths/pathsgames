package games.paths.core.model.auth;

/**
 * RefreshedSession - Immutable domain model representing the result of a token refresh.
 * Contains the new access and refresh tokens issued after a successful rotation.
 */
public class RefreshedSession extends BaseSession {

    private final String role;

    private RefreshedSession(Builder builder) {
        super(builder.userUuid, builder.username, builder.accessToken,
              builder.refreshToken, builder.accessTokenExpiresAt,
              builder.refreshTokenExpiresAt);
        this.role = builder.role;
    }

    public String getRole() {
        return role;
    }

    @Override
    public String toString() {
        return "RefreshedSession{userUuid='" + getUserUuid() + "', username='" + getUsername() + "'}";
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder extends BaseSession.BaseBuilder<Builder> {
        private String role;

        public Builder role(String role) {
            this.role = role;
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
