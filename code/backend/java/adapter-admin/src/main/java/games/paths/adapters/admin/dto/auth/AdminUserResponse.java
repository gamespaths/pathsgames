package games.paths.adapters.admin.dto.auth;

import games.paths.core.model.auth.AdminUserView;

import java.time.Instant;

/**
 * AdminUserResponse - v0.41.6 one user as the admin User tab and the owner-move preview show it,
 * with {@code eligible} and the refusal {@code reason} (USER_NOT_ALLOWED / USER_EXPIRED) of a move.
 */
public record AdminUserResponse(String uuid, String username, String nickname, String email, String role,
                                Integer state, boolean guest, String guestExpiresAt, boolean expired,
                                String tsRegistration, String tsLastAccess, long matchCount,
                                boolean eligible, String reason) {

    public static AdminUserResponse from(AdminUserView v, Instant now) {
        String reason = v.reason(now);
        return new AdminUserResponse(v.uuid(), v.username(), v.nickname(), v.email(), v.role(), v.state(),
                v.isGuest(), v.guestExpiresAt(), v.isExpired(now), v.tsRegistration(), v.tsLastAccess(),
                v.matchCount(), reason == null, reason);
    }
}
