package games.paths.core.port.auth;

import games.paths.core.model.auth.AdminUserActionResult;
import games.paths.core.model.auth.AdminUserDetail;
import games.paths.core.model.auth.AdminUserListFilter;
import games.paths.core.model.auth.AdminUserPage;

/**
 * UserAdminPort - v1.7.0 admin user management: list and search, detail, ban, suspend, unblock, the
 * IDENTITY_MISMATCH actions; every action throws UserAdminException and writes one intervention-log row.
 */
public interface UserAdminPort {

    AdminUserPage list(AdminUserListFilter filter);

    /** The extra detail of a user (identities, stats, sessions, suspension); null for an unknown uuid. */
    AdminUserDetail detail(String userUuid);

    AdminUserActionResult ban(String adminUuid, String userUuid, String reason);

    AdminUserActionResult suspend(String adminUuid, String userUuid, String until, String reason);

    AdminUserActionResult unblock(String adminUuid, String userUuid, String reason);

    /** Arms the one-time re-link: the next verified login with the email replaces the Google subject. */
    AdminUserActionResult relinkSubject(String adminUuid, String userUuid, String reason);

    /** "Delete the old user" of an IDENTITY_MISMATCH: state 7, the deletion job removes it. */
    AdminUserActionResult deleteUser(String adminUuid, String userUuid, String reason);

    /** Removes the intervention-log rows older than 24 months; answers how many. */
    int purgeInterventionLog();
}
