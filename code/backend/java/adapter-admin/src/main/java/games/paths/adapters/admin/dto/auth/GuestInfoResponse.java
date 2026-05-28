package games.paths.adapters.admin.dto.auth;

/**
 * GuestInfoResponse - REST response DTO for guest user details.
 */
public class GuestInfoResponse {

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

    public GuestInfoResponse() {}

    public GuestInfoResponse(String userUuid, String username, String nickname, String role,
                             int state, String guestCookieToken, String guestExpiresAt,
                             String language, String tsRegistration, String tsLastAccess, boolean expired) {
        this.userUuid = userUuid;
        this.username = username;
        this.nickname = nickname;
        this.role = role;
        this.state = state;
        this.guestCookieToken = guestCookieToken;
        this.guestExpiresAt = guestExpiresAt;
        this.language = language;
        this.tsRegistration = tsRegistration;
        this.tsLastAccess = tsLastAccess;
        this.expired = expired;
    }

    public String getUserUuid() { return userUuid; }
    public void setUserUuid(String userUuid) { this.userUuid = userUuid; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public int getState() { return state; }
    public void setState(int state) { this.state = state; }

    public String getGuestCookieToken() { return guestCookieToken; }
    public void setGuestCookieToken(String guestCookieToken) { this.guestCookieToken = guestCookieToken; }

    public String getGuestExpiresAt() { return guestExpiresAt; }
    public void setGuestExpiresAt(String guestExpiresAt) { this.guestExpiresAt = guestExpiresAt; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getTsRegistration() { return tsRegistration; }
    public void setTsRegistration(String tsRegistration) { this.tsRegistration = tsRegistration; }

    public String getTsLastAccess() { return tsLastAccess; }
    public void setTsLastAccess(String tsLastAccess) { this.tsLastAccess = tsLastAccess; }

    public boolean isExpired() { return expired; }
    public void setExpired(boolean expired) { this.expired = expired; }
}
