package games.paths.core.model.auth;

/**
 * GuestInfo - Domain model for guest user details visible to administrators.
 * Contains the identity, session status, and timestamps of a guest user.
 * Immutable value object built via the Builder pattern.
 */
public class GuestInfo {

    private final String userUuid;
    private final String username;
    private final String nickname;
    private final String role;
    private final int state;
    private final String guestCookieToken;
    private final String guestExpiresAt;
    private final String language;
    private final String tsRegistration;
    private final String tsLastAccess;
    private final boolean expired;

    private GuestInfo(Builder builder) {
        this.userUuid = builder.userUuid;
        this.username = builder.username;
        this.nickname = builder.nickname;
        this.role = builder.role;
        this.state = builder.state;
        this.guestCookieToken = builder.guestCookieToken;
        this.guestExpiresAt = builder.guestExpiresAt;
        this.language = builder.language;
        this.tsRegistration = builder.tsRegistration;
        this.tsLastAccess = builder.tsLastAccess;
        this.expired = builder.expired;
    }

    public String getUserUuid() { return userUuid; }
    public String getUsername() { return username; }
    public String getNickname() { return nickname; }
    public String getRole() { return role; }
    public int getState() { return state; }
    public String getGuestCookieToken() { return guestCookieToken; }
    public String getGuestExpiresAt() { return guestExpiresAt; }
    public String getLanguage() { return language; }
    public String getTsRegistration() { return tsRegistration; }
    public String getTsLastAccess() { return tsLastAccess; }
    public boolean isExpired() { return expired; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String userUuid;
        private String username;
        private String nickname;
        private String role;
        private int state;
        private String guestCookieToken;
        private String guestExpiresAt;
        private String language;
        private String tsRegistration;
        private String tsLastAccess;
        private boolean expired;

        public Builder userUuid(String userUuid) { this.userUuid = userUuid; return this; }
        public Builder username(String username) { this.username = username; return this; }
        public Builder nickname(String nickname) { this.nickname = nickname; return this; }
        public Builder role(String role) { this.role = role; return this; }
        public Builder state(int state) { this.state = state; return this; }
        public Builder guestCookieToken(String guestCookieToken) { this.guestCookieToken = guestCookieToken; return this; }
        public Builder guestExpiresAt(String guestExpiresAt) { this.guestExpiresAt = guestExpiresAt; return this; }
        public Builder language(String language) { this.language = language; return this; }
        public Builder tsRegistration(String tsRegistration) { this.tsRegistration = tsRegistration; return this; }
        public Builder tsLastAccess(String tsLastAccess) { this.tsLastAccess = tsLastAccess; return this; }
        public Builder expired(boolean expired) { this.expired = expired; return this; }

        public GuestInfo build() {
            if (userUuid == null || userUuid.isBlank()) {
                throw new IllegalArgumentException("userUuid is required");
            }
            if (username == null || username.isBlank()) {
                throw new IllegalArgumentException("username is required");
            }
            return new GuestInfo(this);
        }
    }
}
