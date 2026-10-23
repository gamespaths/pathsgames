package games.paths.core.model.auth;

/**
 * AdminUserListFilter - v1.7.0 the raw query of GET /api/admin/users: email exact, nickname prefix, state;
 * all blank = active users by last access.
 */
public record AdminUserListFilter(String email, String nickname, String state, String cursor, Integer limit) {
}
