package games.paths.core.persistence.match;

import games.paths.core.model.match.LogTable;
import games.paths.core.port.match.SnapshotStorePort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlParameterValue;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * SnapshotStoreAdapter - v0.41.1 JdbcTemplate adapter of {@link SnapshotStorePort}: every column of the
 * state tables copied as it is (SQLite and PostgreSQL alike), system_snapshot.jsonb_data bound as OTHER.
 */
@Repository
@Transactional
public class SnapshotStoreAdapter implements SnapshotStorePort {

    static final String MATCH_TABLE = "gaming_match";
    static final String CHARACTER_TABLE = "gaming_character_instance";
    // Child rows replaced by a restore, in delete order; none is referenced by another of the list.
    static final List<String> CHILD_TABLES = List.of("gaming_turn_queue", "gaming_active_choices",
            "gaming_story_progress", "gaming_state_registry", "gaming_state_locations",
            "gaming_character_traits", "gaming_inventory_items", "gaming_backpack_resources");
    // The match columns a restore writes back: story, creator, loadout, seed and name never change.
    static final List<String> MATCH_COLUMNS = List.of("status", "current_clock", "id_current_weather",
            "id_character_current_turn", "counter_consecutive_pass", "timestamp_end", "timestamp_gameover",
            "timestamp_lock_expiration");
    static final String SELECT_SNAPSHOT =
            "SELECT id, uuid, clock, type, ts_insert, description, jsonb_data, checksum FROM system_snapshot";
    private static final Set<String> ROW_KEYS = Set.of("id", "id_match");
    private static final Pattern IDENTIFIER = Pattern.compile("[a-z_][a-z0-9_]*");

    private final JdbcTemplate jdbc;

    public SnapshotStoreAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MatchRef> findMatchByUuid(String uuidMatch) {
        return firstMatch("uuid = ?", uuidMatch);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MatchRef> findMatchById(long idMatch) {
        return firstMatch("id = ?", idMatch);
    }

    private Optional<MatchRef> firstMatch(String where, Object arg) {
        return jdbc.query("SELECT id, uuid, id_story, status, current_clock FROM gaming_match WHERE " + where,
                (rs, i) -> new MatchRef(rs.getLong("id"), rs.getString("uuid"), rs.getLong("id_story"),
                        rs.getString("status"), rs.getInt("current_clock")), arg).stream().findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> readState(long idMatch) {
        Map<String, List<Map<String, Object>>> state = new LinkedHashMap<>();
        state.put(MATCH_TABLE, rows("SELECT * FROM " + MATCH_TABLE + " WHERE id = ?", idMatch));
        state.put(CHARACTER_TABLE, rows("SELECT * FROM " + CHARACTER_TABLE + " WHERE id_match = ? ORDER BY id", idMatch));
        for (String table : CHILD_TABLES) {
            state.put(table, rows("SELECT * FROM " + table + " WHERE id_match = ? ORDER BY uuid", idMatch));
        }
        return state;
    }

    private List<Map<String, Object>> rows(String sql, long idMatch) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : jdbc.queryForList(sql, idMatch)) {
            Map<String, Object> clean = new LinkedHashMap<>();
            row.forEach((column, value) -> clean.put(column.toLowerCase(Locale.ROOT), plain(value)));
            out.add(clean);
        }
        return out;
    }

    /** Numbers, strings and booleans as they are; any driver type as its text. */
    static Object plain(Object value) {
        return value == null || value instanceof Number || value instanceof String || value instanceof Boolean
                ? value : value.toString();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, Long> logMarks(long idMatch) {
        Map<String, Long> marks = new LinkedHashMap<>();
        for (LogTable table : LogTable.values()) {
            Long max = jdbc.queryForObject("SELECT COALESCE(MAX(id), 0) FROM " + table.tableName()
                    + " WHERE id_match = ?", Long.class, idMatch);
            marks.put(table.tableName(), max == null ? 0L : max);
        }
        return marks;
    }

    @Override
    public void insert(NewSnapshot s) {
        String now = Instant.now().toString();
        // OTHER: PostgreSQL casts the text to jsonb, SQLite stores it as TEXT.
        jdbc.update("INSERT INTO system_snapshot (uuid, id_story, id_match, type, jsonb_data, description, clock,"
                        + " checksum, ts_insert, ts_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                UUID.randomUUID().toString(), s.idStory(), s.idMatch(), s.type(),
                new SqlParameterValue(Types.OTHER, s.payload()), s.description(), s.clock(), s.checksum(), now, now);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoredSnapshot> list(long idMatch) {
        return jdbc.query(SELECT_SNAPSHOT + " WHERE id_match = ? ORDER BY id DESC",
                (rs, i) -> stored(rs, false), idMatch);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<StoredSnapshot> find(long idMatch, String uuidSnapshot) {
        return jdbc.query(SELECT_SNAPSHOT + " WHERE id_match = ? AND uuid = ?",
                (rs, i) -> stored(rs, true), idMatch, uuidSnapshot).stream().findFirst();
    }

    static StoredSnapshot stored(ResultSet rs, boolean withPayload) throws SQLException {
        String payload = rs.getString("jsonb_data");
        long size = payload == null ? 0L : payload.getBytes(StandardCharsets.UTF_8).length;
        return new StoredSnapshot(rs.getLong("id"), rs.getString("uuid"), rs.getInt("clock"),
                rs.getString("type"), rs.getString("ts_insert"), rs.getString("description"), size,
                withPayload ? payload : null, rs.getString("checksum"));
    }

    @Override
    public int prune(long idMatch, int keep) {
        return jdbc.update("DELETE FROM system_snapshot WHERE id_match = ? AND id NOT IN (SELECT id FROM"
                + " system_snapshot WHERE id_match = ? ORDER BY id DESC LIMIT ?)", idMatch, idMatch, keep);
    }

    @Override
    @Transactional(readOnly = true)
    public Set<Long> existingStoryIds(String table, String column, long idStory, Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Set.of();
        }
        List<Object> args = new ArrayList<>();
        args.add(idStory);
        args.addAll(ids);
        return new HashSet<>(jdbc.queryForList("SELECT " + identifier(column) + " FROM " + identifier(table)
                + " WHERE id_story = ? AND " + column + " IN (" + marks(ids.size()) + ")", Long.class, args.toArray()));
    }

    @Override
    @Transactional(readOnly = true)
    public Set<Long> existingUserIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(jdbc.queryForList("SELECT id FROM users WHERE id IN (" + marks(ids.size()) + ")",
                Long.class, ids.toArray()));
    }

    @Override
    public long restore(long idMatch, long idSnapshot, Map<String, List<Map<String, Object>>> state,
                        Map<String, Long> logMarks) {
        long removed = 0;
        for (LogTable table : LogTable.values()) {
            removed += jdbc.update("DELETE FROM " + table.tableName() + " WHERE id_match = ? AND id > ?",
                    idMatch, logMarks.getOrDefault(table.tableName(), 0L));
        }
        for (String table : CHILD_TABLES) {
            jdbc.update("DELETE FROM " + table + " WHERE id_match = ?", idMatch);
        }
        // Characters in place: their ids are the FK targets of the log rows that stay.
        Set<Long> current = new HashSet<>(jdbc.queryForList(
                "SELECT id FROM " + CHARACTER_TABLE + " WHERE id_match = ?", Long.class, idMatch));
        Set<Long> kept = new HashSet<>();
        for (Map<String, Object> row : state.getOrDefault(CHARACTER_TABLE, List.of())) {
            Long id = row.get("id") instanceof Number n ? n.longValue() : null;
            if (id == null) {
                continue;
            }
            kept.add(id);
            if (current.contains(id)) {
                update(CHARACTER_TABLE, withoutKeys(row), "id = ? AND id_match = ?", id, idMatch);
            } else {
                insert(CHARACTER_TABLE, withMatch(row, idMatch));
            }
        }
        restoreMatchRow(idMatch, state.getOrDefault(MATCH_TABLE, List.of()));
        for (Long id : current) {
            if (!kept.contains(id)) {
                jdbc.update("DELETE FROM " + CHARACTER_TABLE + " WHERE id_match = ? AND id = ?", idMatch, id);
            }
        }
        for (String table : CHILD_TABLES) {
            for (Map<String, Object> row : state.getOrDefault(table, List.of())) {
                insert(table, withMatch(row, idMatch));
            }
        }
        jdbc.update("DELETE FROM system_snapshot WHERE id_match = ? AND id > ?", idMatch, idSnapshot);
        return removed;
    }

    private void restoreMatchRow(long idMatch, List<Map<String, Object>> rows) {
        if (rows.isEmpty()) {
            return;
        }
        Map<String, Object> values = new LinkedHashMap<>();
        for (String column : MATCH_COLUMNS) {
            if (rows.get(0).containsKey(column)) {
                values.put(column, rows.get(0).get(column));
            }
        }
        values.put("ts_update", Instant.now().toString());
        update(MATCH_TABLE, values, "id = ?", idMatch);
    }

    @Override
    public void setStatus(long idMatch, String status) {
        jdbc.update("UPDATE " + MATCH_TABLE + " SET status = ?, ts_update = ? WHERE id = ?",
                status, Instant.now().toString(), idMatch);
    }

    @Override
    public int deleteByMatchIds(Collection<Long> matchIds) {
        if (matchIds == null || matchIds.isEmpty()) {
            return 0;
        }
        return jdbc.update("DELETE FROM system_snapshot WHERE id_match IN (" + marks(matchIds.size()) + ")",
                matchIds.toArray());
    }

    private void update(String table, Map<String, Object> values, String where, Object... keys) {
        List<String> columns = new ArrayList<>(values.keySet());
        if (columns.isEmpty()) {
            return;
        }
        String set = columns.stream().map(c -> quote(c) + " = ?").collect(Collectors.joining(", "));
        List<Object> args = new ArrayList<>();
        columns.forEach(c -> args.add(values.get(c)));
        Collections.addAll(args, keys);
        jdbc.update("UPDATE " + table + " SET " + set + " WHERE " + where, args.toArray());
    }

    private void insert(String table, Map<String, Object> row) {
        List<String> columns = new ArrayList<>(row.keySet());
        List<Object> args = new ArrayList<>();
        columns.forEach(c -> args.add(row.get(c)));
        jdbc.update("INSERT INTO " + table + " (" + columns.stream().map(SnapshotStoreAdapter::quote)
                .collect(Collectors.joining(", ")) + ") VALUES (" + marks(columns.size()) + ")", args.toArray());
    }

    private static Map<String, Object> withoutKeys(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>(row);
        ROW_KEYS.forEach(out::remove);
        return out;
    }

    /** The row pinned to this match, whatever the payload says. */
    private static Map<String, Object> withMatch(Map<String, Object> row, long idMatch) {
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.put("id_match", idMatch);
        return out;
    }

    private static String marks(int count) {
        return String.join(", ", Collections.nCopies(count, "?"));
    }

    /** A column or table name as SQL; anything but a plain lower-case identifier is refused. */
    static String identifier(String name) {
        if (name == null || !IDENTIFIER.matcher(name).matches()) {
            throw new IllegalArgumentException("Not a plain identifier: " + name);
        }
        return name;
    }

    static String quote(String name) {
        return "\"" + identifier(name) + "\"";
    }
}
