package games.paths.adapters.rest.dto;

/**
 * RefreshTokenResponse - DTO returned after a successful token refresh.
 *
 * <p>Extends {@link GuestLoginResponse} (which carries userUuid, username,
 * accessToken, accessTokenExpiresAt, refreshTokenExpiresAt) and adds the
 * authenticated user's {@code role}.</p>
 *
 * <p>Since v0.13.0-httponly, the new refresh token is delivered as an HttpOnly
 * cookie (set by the controller). Only the new access token and metadata are
 * returned in the JSON body.</p>
 */
public class RefreshTokenResponse extends GuestLoginResponse {

    private String role;

    public RefreshTokenResponse() {
    }

    public RefreshTokenResponse(String userUuid, String username, String role,
                                 String accessToken,
                                 long accessTokenExpiresAt, long refreshTokenExpiresAt) {
        super(userUuid, username, accessToken, accessTokenExpiresAt, refreshTokenExpiresAt);
        this.role = role;
    }

    public String getRole() {
        return role;
    }

    public void setRole(String role) {
        this.role = role;
    }
}
