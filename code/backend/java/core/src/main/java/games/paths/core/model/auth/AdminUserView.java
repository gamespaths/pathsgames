package games.paths.core.model.auth;

import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * AdminUserView - v0.41.6 the admin view of one user (User tab and owner-move preview) with its
 * move eligibility; {@code state} 1=registration, 2=active, 3=blocked, 4=banned, 5=password_reset, 6=guest.
 */
public record AdminUserView(Long id, String uuid, String username, String nickname, String email, String role,
                            Integer state, String guestExpiresAt, String tsRegistration, String tsLastAccess,
                            long matchCount) {

    public static final int STATE_ACTIVE = 2;
    public static final int STATE_GUEST = 6;
    public static final String ROLE_ADMIN = "ADMIN";
    public static final String REASON_NOT_ALLOWED = "USER_NOT_ALLOWED";
    public static final String REASON_EXPIRED = "USER_EXPIRED";

    public AdminUserView withMatchCount(long count) {
        return new AdminUserView(id, uuid, username, nickname, email, role, state, guestExpiresAt,
                tsRegistration, tsLastAccess, count);
    }

    public boolean isGuest() {
        return state != null && state == STATE_GUEST;
    }

    /** A guest without expiry (an imported one) or with an unreadable date is not expired. */
    public boolean isExpired(Instant now) {
        if (!isGuest() || guestExpiresAt == null || guestExpiresAt.isBlank()) {
            return false;
        }
        try {
            return now.isAfter(Instant.parse(guestExpiresAt));
        } catch (DateTimeParseException e) {
            return false;
        }
    }

    /** Null when the user may receive a match, else USER_NOT_ALLOWED or USER_EXPIRED. */
    public String reason(Instant now) {
        if (ROLE_ADMIN.equalsIgnoreCase(role) || state == null
                || (state != STATE_ACTIVE && state != STATE_GUEST)) {
            return REASON_NOT_ALLOWED;
        }
        return isExpired(now) ? REASON_EXPIRED : null;
    }

    public boolean isEligible(Instant now) {
        return reason(now) == null;
    }
}
