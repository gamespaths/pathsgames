package games.paths.core.persistence.match;

import games.paths.core.port.match.KpiStorePort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * KpiStoreAdapter - v0.41.2 JdbcTemplate adapter of {@link KpiStorePort}: one upsert per counter,
 * the same ON CONFLICT statement on SQLite and PostgreSQL, in its own transaction.
 */
@Repository
@Transactional
public class KpiStoreAdapter implements KpiStorePort {

    static final String UPSERT_SQL = "INSERT INTO system_kpi_daily "
            + "(uuid, story_uuid, day, metric, ref_uuid, value, ts_insert, ts_update) "
            + "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
            + "ON CONFLICT (story_uuid, day, metric, ref_uuid) "
            + "DO UPDATE SET value = system_kpi_daily.value + excluded.value, ts_update = excluded.ts_update";
    static final String SELECT_SQL =
            "SELECT story_uuid, day, metric, ref_uuid, value FROM system_kpi_daily WHERE day >= ? AND day <= ?";

    private final JdbcTemplate jdbc;

    public KpiStoreAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void increment(String storyUuid, String day, String metric, String refUuid, long delta) {
        String now = Instant.now().toString();
        jdbc.update(UPSERT_SQL, UUID.randomUUID().toString(), storyUuid, day, metric,
                refUuid == null ? "" : refUuid, delta, now, now);
    }

    @Override
    @Transactional(readOnly = true)
    public List<KpiDailyRow> findRows(String storyUuid, String fromDay, String toDay) {
        List<Object> args = new ArrayList<>(List.of(fromDay, toDay));
        String sql = SELECT_SQL;
        if (storyUuid != null) {
            sql += " AND story_uuid = ?";
            args.add(storyUuid);
        }
        return jdbc.query(sql, (rs, i) -> new KpiDailyRow(rs.getString("story_uuid"), rs.getString("day"),
                rs.getString("metric"), rs.getString("ref_uuid"), rs.getLong("value")), args.toArray());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> findStoryUuidByMatch(long idMatch) {
        return jdbc.queryForList("SELECT s.uuid FROM gaming_match m JOIN list_stories s ON s.id = m.id_story "
                + "WHERE m.id = ?", String.class, idMatch).stream().findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> findLocationUuid(long idStory, long idLocation) {
        return jdbc.queryForList("SELECT uuid FROM list_locations WHERE id = ? AND id_story = ?", String.class,
                        idLocation, idStory)
                .stream().findFirst();
    }
}
