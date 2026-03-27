package games.paths.adapters.rest.dto;

/**
 * GuestLoginResponse - DTO for the guest login API response.
 * Contains the JWT tokens, user identity, and session metadata.
 */
public class GuestLoginResponse {

    private String userUuid;
    private String username;
    private String accessToken;
    private String refreshToken;
    private long accessTokenExpiresAt;
    private long refreshTokenExpiresAt;
    private String guestCookieToken;

    public GuestLoginResponse() {
    }

    public GuestLoginResponse(String userUuid, String username, String accessToken,
                              String refreshToken, long accessTokenExpiresAt,
                              long refreshTokenExpiresAt, String guestCookieToken) {
        this.userUuid = userUuid;
        this.username = username;
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.accessTokenExpiresAt = accessTokenExpiresAt;
        this.refreshTokenExpiresAt = refreshTokenExpiresAt;
        this.guestCookieToken = guestCookieToken;
    }

    public String getUserUuid() {
        return userUuid;
    }

    public void setUserUuid(String userUuid) {
        this.userUuid = userUuid;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public long getAccessTokenExpiresAt() {
        return accessTokenExpiresAt;
    }

    public void setAccessTokenExpiresAt(long accessTokenExpiresAt) {
        this.accessTokenExpiresAt = accessTokenExpiresAt;
    }

    public long getRefreshTokenExpiresAt() {
        return refreshTokenExpiresAt;
    }

    public void setRefreshTokenExpiresAt(long refreshTokenExpiresAt) {
        this.refreshTokenExpiresAt = refreshTokenExpiresAt;
    }

    public String getGuestCookieToken() {
        return guestCookieToken;
    }

    public void setGuestCookieToken(String guestCookieToken) {
        this.guestCookieToken = guestCookieToken;
    }
}
