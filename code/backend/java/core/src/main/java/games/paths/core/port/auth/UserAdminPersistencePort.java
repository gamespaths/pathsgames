package games.paths.core.port.auth;

import games.paths.core.model.auth.AdminUserItem;

import java.util.List;
import java.util.Optional;

/**
 * UserAdminPersistencePort - v1.7.0 the admin user list, users.suspended_until, users.relink_pending and
 * users_banned_subjects (HMAC of sub and email, no personal data).
 */
public interface UserAdminPersistencePort {

    /** Non-guest users of the state (any when null) whose lowercase nickname starts with the prefix, after the key. */
    List<AdminUserItem> listByNickname(Integer state, String prefix, String afterNickname, String afterUuid, int limit);

    /** Users of the state, newest last access first, after the key (last access, uuid). */
    List<AdminUserItem> listByLastAccess(int state, String afterAccess, String afterUuid, int limit);

    /** The non-guest user with this lowercase email. */
    Optional<AdminUserItem> findByEmail(String email);

    Optional<AdminUserItem> findByUuid(String uuid);

    /** users.email_address of the user, empty when none. */
    Optional<String> findEmail(long userId);

    /** Sets the state and suspended_until (null clears it). */
    void updateStateAndSuspension(long userId, int state, String suspendedUntil);

    boolean isRelinkPending(long userId);

    void setRelinkPending(long userId, boolean pending);

    /** Replaces the subject of an identity (the armed re-link); clears relink_pending of its user. */
    void replaceIdentitySubject(long identityId, long userId, String subject);

    /** One row per banned user; a hash already stored for another user is kept. */
    void storeBannedHashes(String userUuid, String hashSub, String hashEmail);

    int deleteBannedHashes(String userUuid);

    boolean hasBannedHashes(String userUuid);

    /** True when either hash (null ignored) belongs to a banned subject. */
    boolean isBanned(String hashSub, String hashEmail);
}
