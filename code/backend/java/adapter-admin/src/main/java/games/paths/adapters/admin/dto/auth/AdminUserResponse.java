package games.paths.adapters.admin.dto.auth;

import games.paths.core.model.auth.AdminUserDetail;
import games.paths.core.model.auth.AdminUserView;
import games.paths.core.model.auth.UserIdentity;
import games.paths.core.model.auth.UserStats;

import java.time.Instant;
import java.util.List;

/**
 * AdminUserResponse - v0.41.6 one user as the admin User tab and the owner-move preview show it, with
 * {@code eligible} and the move refusal {@code reason}; v1.7.0 the detail (identities, stats, sessions, suspension).
 */
public record AdminUserResponse(String uuid, String username, String nickname, String email, String role,
                                Integer state, boolean guest, String guestExpiresAt, boolean expired,
                                String tsRegistration, String tsLastAccess, long matchCount,
                                boolean eligible, String reason, String accountType, String suspendedUntil,
                                Boolean relinkPending, Boolean banned, Integer sessions, UserStats stats,
                                List<IdentityResponse> identities) {

    /** One login identity of the user (admin detail only). */
    public record IdentityResponse(String provider, String subject, String email, String profileName,
                                   String givenName, String familyName, String pictureUrl, String locale,
                                   String tsProfileUpdate) {

        static IdentityResponse of(UserIdentity i) {
            return new IdentityResponse(i.provider(), i.subject(), i.email(), i.profileName(), i.givenName(),
                    i.familyName(), i.pictureUrl(), i.locale(), i.tsProfileUpdate());
        }
    }

    public static AdminUserResponse from(AdminUserView v, Instant now) {
        return from(v, now, null);
    }

    public static AdminUserResponse from(AdminUserView v, Instant now, AdminUserDetail d) {
        String reason = v.reason(now);
        return new AdminUserResponse(v.uuid(), v.username(), v.nickname(), v.email(), v.role(), v.state(),
                v.isGuest(), v.guestExpiresAt(), v.isExpired(now), v.tsRegistration(), v.tsLastAccess(),
                v.matchCount(), reason == null, reason, d == null ? null : d.accountType(),
                d == null ? null : d.suspendedUntil(), d == null ? null : d.relinkPending(),
                d == null ? null : d.banned(), d == null ? null : d.sessions(), d == null ? null : d.stats(),
                d == null ? null : d.identities().stream().map(IdentityResponse::of).toList());
    }
}
