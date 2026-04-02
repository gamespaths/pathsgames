package games.paths.adapters.rest.dto;

/**
 * GuestLoginResponse - DTO for the guest login API response.
 *
 * <p>Since v0.13.0-httponly, the response body only contains the access token
 * and session metadata. The refresh token and guest-cookie-token are delivered
 * as HttpOnly cookies (set by the controller), keeping them out of reach of
 * any JavaScript running in the browser (XSS blast-radius reduction).</p>
 */
public class GuestLoginResponse {

    private String userUuid;
    private String username;
    private String accessToken;
    private long accessTokenExpiresAt;
    private long refreshTokenExpiresAt;

    public GuestLoginResponse() {
    }

    public GuestLoginResponse(String userUuid, String username, String accessToken,
                              long accessTokenExpiresAt, long refreshTokenExpiresAt) {
        this.userUuid = userUuid;
        this.username = username;
        this.accessToken = accessToken;
        this.accessTokenExpiresAt = accessTokenExpiresAt;
        this.refreshTokenExpiresAt = refreshTokenExpiresAt;
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
}
