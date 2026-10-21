package games.paths.core.port.auth;

import games.paths.core.model.auth.AuthenticatedSession;
import games.paths.core.model.auth.GoogleLoginCommand;

/**
 * GoogleLoginPort - v1.2.0 inbound port of POST /api/auth/google; throws AuthException on refusal.
 */
public interface GoogleLoginPort {

    AuthenticatedSession login(GoogleLoginCommand command);

    boolean isEnabled();

    String clientId();
}
