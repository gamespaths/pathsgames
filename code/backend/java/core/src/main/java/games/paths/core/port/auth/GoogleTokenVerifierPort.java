package games.paths.core.port.auth;

import games.paths.core.model.auth.GoogleIdentityClaims;

/**
 * GoogleTokenVerifierPort - v1.2.0 checks the signature of a Google ID token and reads its claims;
 * throws AuthException INVALID_TOKEN or PROVIDER_UNAVAILABLE (JWKS fetch failure).
 */
public interface GoogleTokenVerifierPort {

    GoogleIdentityClaims verify(String idToken);

    /** The OAuth client id of this stage, expected as the token audience. */
    String clientId();
}
