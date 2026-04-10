package games.paths.core.model.auth;

/**
 * BaseSession - Abstract base for session domain models.
 *
 * <p>Holds the six fields shared by both {@link GuestSession} and
 * {@link RefreshedSession}: userUuid, username, accessToken, refreshToken,
 * accessTokenExpiresAt and refreshTokenExpiresAt.</p>
 *
 * <p>Concrete session types extend this class to add their specific
 * fields (e.g. {@code guestCookieToken} or {@code role}).</p>
 */
public abstract class BaseSession {

    private final String userUuid;
    private final String username;
    private final String accessToken;
    private final String refreshToken;
    private final long accessTokenExpiresAt;
    private final long refreshTokenExpiresAt;

    protected BaseSession(String userUuid, String username, String accessToken,
                           String refreshToken, long accessTokenExpiresAt,
                           long refreshTokenExpiresAt) {
        this.userUuid = userUuid;
        this.username = username;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.accessTokenExpiresAt = accessTokenExpiresAt;
        this.refreshTokenExpiresAt = refreshTokenExpiresAt;
    }

    public String getUserUuid() { return userUuid; }
    public String getUsername() { return username; }
    public String getAccessToken() { return accessToken; }
    public String getRefreshToken() { return refreshToken; }
    public long getAccessTokenExpiresAt() { return accessTokenExpiresAt; }
    public long getRefreshTokenExpiresAt() { return refreshTokenExpiresAt; }

    /**
     * Abstract base for session builders.
     *
     * @param <T> the concrete builder type (for fluent chaining)
     */
    @SuppressWarnings("unchecked")
    public abstract static class BaseBuilder<T extends BaseBuilder<T>> {
        protected String userUuid;
        protected String username;
        protected String accessToken;
        protected String refreshToken;
        protected long accessTokenExpiresAt;
        protected long refreshTokenExpiresAt;

        public T userUuid(String userUuid) { this.userUuid = userUuid; return (T) this; }
        public T username(String username) { this.username = username; return (T) this; }
        public T accessToken(String accessToken) { this.accessToken = accessToken; return (T) this; }
        public T refreshToken(String refreshToken) { this.refreshToken = refreshToken; return (T) this; }
        public T accessTokenExpiresAt(long v) { this.accessTokenExpiresAt = v; return (T) this; }
        public T refreshTokenExpiresAt(long v) { this.refreshTokenExpiresAt = v; return (T) this; }
    }
}
