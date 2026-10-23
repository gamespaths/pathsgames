package games.paths.core.model.auth;

/**
 * AdminUserItem - v1.7.0 one row of GET /api/admin/users (never the email): accountType GOOGLE or INTERNAL,
 * suspendedUntil set only for a suspended user (state 3).
 */
public record AdminUserItem(long id, String uuid, String nickname, int state, String role, String accountType,
                            String tsRegistration, String tsLastAccess, String suspendedUntil) {

    public static final String TYPE_GOOGLE = "GOOGLE";
    public static final String TYPE_INTERNAL = "INTERNAL";

    public boolean isAdmin() {
        return UserStates.ROLE_ADMIN.equals(role);
    }

    public boolean isGuest() {
        return state == UserStates.GUEST;
    }
}
