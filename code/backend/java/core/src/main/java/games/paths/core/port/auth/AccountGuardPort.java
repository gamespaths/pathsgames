package games.paths.core.port.auth;

import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStatus;

/**
 * AccountGuardPort - v1.7.0 the login and refresh checks of step 10: banned-subject hashes, the end of a
 * suspension (automatic unblock) and the one-time re-link of an IDENTITY_MISMATCH.
 */
public interface AccountGuardPort {

    /** Throws ACCOUNT_DISABLED when the HMAC of the subject or of the email is banned. */
    void checkNotBanned(String subject, String email);

    /** The user, unblocked when its suspension is over; throws the state refusal (with suspendedUntil). */
    UserStatus admit(UserStatus user);

    /** True when a re-link was armed for the identity's user: the subject is replaced and the flag cleared. */
    boolean relink(UserIdentity identity, String newSubject);
}
