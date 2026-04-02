package games.paths.adapters.rest.dto;

/**
 * RefreshTokenRequest - DTO for the token refresh endpoint.
 * Contains the refresh token to be exchanged for a new token pair.
 */
public class RefreshTokenRequest {

    private String refreshToken;

    public RefreshTokenRequest() {
    }

    public RefreshTokenRequest(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }
}
