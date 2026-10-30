package games.paths.core.model.auth;

import java.util.List;

/**
 * AdminUserDetail - v1.7.0 what the admin user detail adds to the user view: identities, statistics,
 * open sessions, suspension, armed re-link and banned-subject hashes present.
 */
public record AdminUserDetail(String accountType, String suspendedUntil, boolean relinkPending, boolean banned,
                              int sessions, UserStats stats, List<UserIdentity> identities) {
}
