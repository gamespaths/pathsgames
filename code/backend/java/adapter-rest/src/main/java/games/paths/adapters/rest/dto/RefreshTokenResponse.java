package games.paths.adapters.rest.dto;

/**
 * RefreshTokenResponse - DTO returned after a successful token refresh.
 *
 * <p>Since v0.13.0-httponly, the new refresh token is delivered as an HttpOnly
 * cookie (set by the controller). Only the new access token and metadata are
 * returned in the JSON body.</p>
 */
public class RefreshTokenResponse {

    private String userUuid;
    private String username;
    private String role;
    private String accessToken;
    private long accessTokenExpiresAt;
    private long refreshTokenExpiresAt;

    public RefreshTokenResponse() {
    }

    public RefreshTokenResponse(String userUuid, String username, String role,
                                 String accessToken,
                                 long accessTokenExpiresAt, long refreshTokenExpiresAt) {
        this.userUuid = userUuid;
        this.username = username;
        this.role = role;
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

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
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
