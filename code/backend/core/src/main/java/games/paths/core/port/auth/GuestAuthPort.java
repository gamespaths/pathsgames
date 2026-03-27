package games.paths.core.port.auth;

import games.paths.core.model.auth.GuestSession;

/**
 * GuestAuthPort - Inbound port for guest authentication use cases.
 * Part of the Hexagonal Architecture: this is a domain port
 * that the adapter-rest module will call to handle guest login.
 */
public interface GuestAuthPort {

    /**
     * Creates a new guest session with an anonymous UUID identity.
     * Generates a guest user, issues JWT tokens, and persists the session.
     *
     * @return a GuestSession containing the user UUID, tokens, and expiration info
     */
    GuestSession createGuestSession();

    /**
     * Resumes an existing guest session using the guest cookie token.
     * If the session is still valid, issues new JWT tokens.
     *
     * @param guestCookieToken the cookie token identifying the guest
     * @return a GuestSession with refreshed tokens, or null if the session is expired/invalid
     */
    GuestSession resumeGuestSession(String guestCookieToken);

    /**
     * Removes expired guest sessions from the database.
     *
     * @return the number of expired sessions cleaned up
     */
    int cleanupExpiredGuestSessions();
}
