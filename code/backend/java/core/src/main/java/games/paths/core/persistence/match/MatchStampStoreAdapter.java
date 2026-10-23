package games.paths.core.persistence.match;

import games.paths.core.port.match.MatchStampStorePort;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * MatchStampStoreAdapter - v1.7.0 {@link MatchStampStorePort} on gaming_match: two plain statements, so
 * the JPA entity (whose ts_update and play_ms are not updatable) never writes a second value.
 */
@Repository
@Transactional
public class MatchStampStoreAdapter implements MatchStampStorePort {

    static final String SELECT_TS = "SELECT ts_update FROM gaming_match WHERE uuid = ?";
    static final String STAMP = "UPDATE gaming_match SET ts_update = ?, play_ms = COALESCE(play_ms, 0) + ? WHERE uuid = ?";
    static final String CLAIM = "UPDATE gaming_match SET ts_update = ?, play_ms = COALESCE(play_ms, 0) + ? "
            + "WHERE uuid = ? AND ts_update = ?";

    private final JdbcTemplate jdbc;

    public MatchStampStoreAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> findTsUpdate(String matchUuid) {
        List<String> rows = jdbc.queryForList(SELECT_TS, String.class, matchUuid);
        return rows.isEmpty() ? Optional.empty() : Optional.ofNullable(rows.get(0));
    }

    @Override
    public boolean stamp(String matchUuid, String tsUpdate, long playMsDelta) {
        return jdbc.update(STAMP, tsUpdate, playMsDelta, matchUuid) > 0;
    }

    @Override
    public boolean claim(String matchUuid, String oldVersion, String newVersion, long playMsDelta) {
        return jdbc.update(CLAIM, newVersion, playMsDelta, matchUuid, oldVersion) == 1;
    }
}
