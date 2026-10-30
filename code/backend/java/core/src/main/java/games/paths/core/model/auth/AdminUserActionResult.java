package games.paths.core.model.auth;

import java.util.List;

/** AdminUserActionResult - v1.7.0 the answer of a ban, suspend, unblock, re-link or deletion of a user. */
public record AdminUserActionResult(String uuid, String action, int state, String suspendedUntil,
                                    boolean relinkPending, List<String> bannedMatchUuids) {
}
