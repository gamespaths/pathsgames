package games.paths.adapters.auth.google;

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.JsonFactory;
import com.google.api.client.json.gson.GsonFactory;
import games.paths.core.model.auth.AuthException;
import games.paths.core.model.auth.GoogleIdentityClaims;
import games.paths.core.port.auth.GoogleTokenVerifierPort;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.List;

/**
 * GoogleIdTokenVerifierAdapter - v1.2.0 {@link GoogleTokenVerifierPort} with Google's GoogleIdTokenVerifier
 * (cached public keys, no client secret); a fake token goes to {@link FakeGoogleTokens} when enabled.
 */
public class GoogleIdTokenVerifierAdapter implements GoogleTokenVerifierPort {

    /** The token check of the Google library; a seam for the unit tests. */
    public interface Checker {
        boolean verify(GoogleIdToken token) throws GeneralSecurityException, IOException;
    }

    private final String clientId;
    private final FakeGoogleTokens fake;
    private final JsonFactory jsonFactory;
    private final Checker checker;

    public GoogleIdTokenVerifierAdapter(String clientId, FakeGoogleTokens fake) {
        this(clientId, fake, GsonFactory.getDefaultInstance(), new GoogleIdTokenVerifier.Builder(
                new NetHttpTransport(), GsonFactory.getDefaultInstance())
                .setAudience(List.of(clientId))
                .setIssuers(List.of("accounts.google.com", "https://accounts.google.com"))
                .build()::verify);
    }

    GoogleIdTokenVerifierAdapter(String clientId, FakeGoogleTokens fake, JsonFactory jsonFactory, Checker checker) {
        this.clientId = clientId;
        this.fake = fake;
        this.jsonFactory = jsonFactory;
        this.checker = checker;
    }

    @Override
    public String clientId() {
        return clientId;
    }

    @Override
    public GoogleIdentityClaims verify(String idToken) {
        if (fake != null && fake.isEnabled() && FakeGoogleTokens.isFake(idToken)) {
            return fake.verify(idToken);
        }
        GoogleIdToken token;
        try {
            token = GoogleIdToken.parse(jsonFactory, idToken);
        } catch (IOException | IllegalArgumentException | NullPointerException malformed) {
            throw new AuthException(AuthException.Code.INVALID_TOKEN, "The Google token is malformed");
        }
        boolean valid;
        try {
            valid = checker.verify(token);
        } catch (IOException | GeneralSecurityException unavailable) {
            throw new AuthException(AuthException.Code.PROVIDER_UNAVAILABLE, "Google keys are not reachable",
                    unavailable);
        }
        if (!valid) {
            throw new AuthException(AuthException.Code.INVALID_TOKEN, "The Google token is invalid or expired");
        }
        return toClaims(token.getPayload());
    }

    static GoogleIdentityClaims toClaims(GoogleIdToken.Payload p) {
        Object aud = p.getAudience();
        String audience = aud instanceof List<?> list ? (list.isEmpty() ? null : String.valueOf(list.get(0)))
                : (aud == null ? null : String.valueOf(aud));
        return new GoogleIdentityClaims(p.getSubject(), p.getEmail(), Boolean.TRUE.equals(p.getEmailVerified()),
                str(p.get("name")), str(p.get("given_name")), str(p.get("family_name")), str(p.get("picture")),
                str(p.get("locale")), p.getNonce(), p.getIssuer(), audience,
                p.getExpirationTimeSeconds() == null ? 0 : p.getExpirationTimeSeconds(),
                p.getIssuedAtTimeSeconds() == null ? 0 : p.getIssuedAtTimeSeconds());
    }

    private static String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }
}
