package games.paths.adapters.admin.dto.auth;

/** AdminUserActionRequest - v1.7.0 body of ban, suspend, unblock, relink-subject, deletion: reason (+ until). */
public record AdminUserActionRequest(String reason, String until) {
}
