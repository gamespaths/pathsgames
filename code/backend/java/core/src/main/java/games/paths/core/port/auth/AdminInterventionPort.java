package games.paths.core.port.auth;

/**
 * AdminInterventionPort - v1.7.0 the writer of the admin intervention log: admin uuid, action, target uuid
 * and reason only (never nickname or email); rows older than the retention are purged.
 */
public interface AdminInterventionPort {

    void record(String adminUuid, String action, String targetUuid, String reason);

    /** Deletes the rows inserted before the ISO-8601 bound; answers how many. */
    int deleteOlderThan(String isoBound);
}
