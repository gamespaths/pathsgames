package games.paths.core.port.auth;

import games.paths.core.model.auth.AdminBootstrapResult;

/**
 * AdminBootstrapPort - v1.2.0 creates a real admin user (or finds it again by nickname) and signs
 * an admin access token for it; throws AuthException NICKNAME_TAKEN or INVALID_REQUEST.
 */
public interface AdminBootstrapPort {

    AdminBootstrapResult createAdmin(String nickname);
}
