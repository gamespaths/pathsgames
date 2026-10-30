package games.paths.adapters.auth.persistence;

import games.paths.core.port.auth.AdminInterventionPort;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * AdminInterventionAdapter - v1.7.0 {@link AdminInterventionPort} on admin_intervention_log: one row per
 * admin action (admin uuid, action, target uuid, reason), purged after 24 months.
 */
@Repository
@Transactional
public class AdminInterventionAdapter implements AdminInterventionPort {

    static final String INSERT = "INSERT INTO admin_intervention_log (uuid, ts_insert, admin_uuid, action,"
            + " target_uuid, reason) VALUES (?, ?, ?, ?, ?, ?)";

    private final JdbcTemplate jdbc;

    public AdminInterventionAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void record(String adminUuid, String action, String targetUuid, String reason) {
        jdbc.update(INSERT, UUID.randomUUID().toString(), Instant.now().toString(),
                adminUuid == null || adminUuid.isBlank() ? "UNKNOWN" : adminUuid, action, targetUuid, reason);
    }

    @Override
    public int deleteOlderThan(String isoBound) {
        return jdbc.update("DELETE FROM admin_intervention_log WHERE ts_insert < ?", isoBound);
    }
}
