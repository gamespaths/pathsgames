package games.paths.core.model.auth;

/**
 * GuestSession - Domain model representing a guest user session.
 * A guest is an anonymous user identified by a UUID, with a limited-time session.
 * Pure domain object with no framework dependencies.
 */
public class GuestSession extends BaseSession {

    private final String guestCookieToken;

    private GuestSession(Builder builder) {
        super(builder.userUuid, builder.username, builder.accessToken,
              builder.refreshToken, builder.accessTokenExpiresAt,
              builder.refreshTokenExpiresAt);
        this.guestCookieToken = builder.guestCookieToken;
    }

    public String getGuestCookieToken() {
        return guestCookieToken;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static class Builder extends BaseSession.BaseBuilder<Builder> {
        private String guestCookieToken;

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
        return "GuestSession{userUuid='" + getUserUuid() + "', username='" + getUsername() + "'}";
    }
}
