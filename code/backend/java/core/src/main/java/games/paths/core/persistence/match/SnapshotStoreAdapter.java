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
import java.util.Arrays;
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
import java.util.function.UnaryOperator;
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

    private static final String FIND_MATCH = "SELECT id, uuid, id_story, status, current_clock FROM gaming_match WHERE ";
    private static final String FIND_MATCH_BY_UUID = FIND_MATCH + "uuid = ?";
    private static final String FIND_MATCH_BY_ID = FIND_MATCH + "id = ?";
    private static final String SELECT_MATCH_ROW = "SELECT * FROM gaming_match WHERE id = ?";
    private static final String SELECT_CHARACTERS = "SELECT * FROM gaming_character_instance WHERE id_match = ? ORDER BY id";
    private static final String SELECT_CHARACTER_IDS = "SELECT id FROM gaming_character_instance WHERE id_match = ?";
    private static final String DELETE_CHARACTER = "DELETE FROM gaming_character_instance WHERE id_match = ? AND id = ?";
    private static final String UPDATE_MATCH_STATUS = "UPDATE gaming_match SET status = ?, ts_update = ? WHERE id = ?";
    private static final String SELECT_USER_IDS = "SELECT id FROM users WHERE id IN (";
    private static final String DELETE_SNAPSHOTS_BY_MATCHES = "DELETE FROM system_snapshot WHERE id_match IN (";
    private static final String DELETE_SNAPSHOTS_AFTER = "DELETE FROM system_snapshot WHERE id_match = ? AND id > ?";
    private static final String INSERT_SNAPSHOT = "INSERT INTO system_snapshot (uuid, id_story, id_match, type,"
            + " jsonb_data, description, clock, checksum, ts_insert, ts_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    private static final String PRUNE_SNAPSHOTS = "DELETE FROM system_snapshot WHERE id_match = ? AND id NOT IN"
            + " (SELECT id FROM system_snapshot WHERE id_match = ? ORDER BY id DESC LIMIT ?)";
    private static final String LIST_SNAPSHOTS = SELECT_SNAPSHOT + " WHERE id_match = ? ORDER BY id DESC";
    private static final String FIND_SNAPSHOT = SELECT_SNAPSHOT + " WHERE id_match = ? AND uuid = ?";

    // One statement per known table, built once from validated names.
    private static final Map<String, String> SELECT_CHILD_ROWS = perTable(CHILD_TABLES,
            t -> "SELECT * FROM " + t + " WHERE id_match = ? ORDER BY uuid");
    private static final Map<String, String> DELETE_CHILD_ROWS = perTable(CHILD_TABLES,
            t -> "DELETE FROM " + t + " WHERE id_match = ?");
    private static final List<String> LOG_TABLES = Arrays.stream(LogTable.values()).map(LogTable::tableName).toList();
    private static final Map<String, String> SELECT_LOG_MARK = perTable(LOG_TABLES,
            t -> "SELECT COALESCE(MAX(id), 0) FROM " + t + " WHERE id_match = ?");
    private static final Map<String, String> DELETE_LOG_AFTER = perTable(LOG_TABLES,
            t -> "DELETE FROM " + t + " WHERE id_match = ? AND id > ?");

    private final JdbcTemplate jdbc;

    public SnapshotStoreAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MatchRef> findMatchByUuid(String uuidMatch) {
        return firstMatch(FIND_MATCH_BY_UUID, uuidMatch);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<MatchRef> findMatchById(long idMatch) {
        return firstMatch(FIND_MATCH_BY_ID, idMatch);
    }

    private Optional<MatchRef> firstMatch(String sql, Object arg) {
        return jdbc.query(sql,
                (rs, i) -> new MatchRef(rs.getLong("id"), rs.getString("uuid"), rs.getLong("id_story"),
                        rs.getString("status"), rs.getInt("current_clock")), arg).stream().findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public Map<String, List<Map<String, Object>>> readState(long idMatch) {
        Map<String, List<Map<String, Object>>> state = new LinkedHashMap<>();
        state.put(MATCH_TABLE, rows(SELECT_MATCH_ROW, idMatch));
        state.put(CHARACTER_TABLE, rows(SELECT_CHARACTERS, idMatch));
        SELECT_CHILD_ROWS.forEach((table, sql) -> state.put(table, rows(sql, idMatch)));
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
        SELECT_LOG_MARK.forEach((table, sql) -> {
            Long max = jdbc.queryForObject(sql, Long.class, idMatch);
            marks.put(table, max == null ? 0L : max);
        });
        return marks;
    }

    @Override
    public void insert(NewSnapshot s) {
        String now = Instant.now().toString();
        // OTHER: PostgreSQL casts the text to jsonb, SQLite stores it as TEXT.
        jdbc.update(INSERT_SNAPSHOT,
                UUID.randomUUID().toString(), s.idStory(), s.idMatch(), s.type(),
                new SqlParameterValue(Types.OTHER, s.payload()), s.description(), s.clock(), s.checksum(), now, now);
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoredSnapshot> list(long idMatch) {
        return jdbc.query(LIST_SNAPSHOTS, (rs, i) -> stored(rs, false), idMatch);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<StoredSnapshot> find(long idMatch, String uuidSnapshot) {
        return jdbc.query(FIND_SNAPSHOT, (rs, i) -> stored(rs, true), idMatch, uuidSnapshot).stream().findFirst();
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
        return jdbc.update(PRUNE_SNAPSHOTS, idMatch, idMatch, keep);
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
        String sql = existingIdsSql(table, column, ids.size());
        return new HashSet<>(jdbc.queryForList(sql, Long.class, args.toArray()));
    }

    @Override
    @Transactional(readOnly = true)
    public Set<Long> existingUserIds(Collection<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return Set.of();
        }
        String sql = inClause(SELECT_USER_IDS, ids.size());
        return new HashSet<>(jdbc.queryForList(sql, Long.class, ids.toArray()));
    }

    @Override
    public long restore(long idMatch, long idSnapshot, Map<String, List<Map<String, Object>>> state,
                        Map<String, Long> logMarks) {
        long removed = 0;
        for (Map.Entry<String, String> delete : DELETE_LOG_AFTER.entrySet()) {
            removed += jdbc.update(delete.getValue(), idMatch, logMarks.getOrDefault(delete.getKey(), 0L));
        }
        DELETE_CHILD_ROWS.values().forEach(sql -> jdbc.update(sql, idMatch));
        // Characters in place: their ids are the FK targets of the log rows that stay.
        Set<Long> current = new HashSet<>(jdbc.queryForList(SELECT_CHARACTER_IDS, Long.class, idMatch));
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
                jdbc.update(DELETE_CHARACTER, idMatch, id);
            }
        }
        for (String table : CHILD_TABLES) {
            for (Map<String, Object> row : state.getOrDefault(table, List.of())) {
                insert(table, withMatch(row, idMatch));
            }
        }
        jdbc.update(DELETE_SNAPSHOTS_AFTER, idMatch, idSnapshot);
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
        jdbc.update(UPDATE_MATCH_STATUS, status, Instant.now().toString(), idMatch);
    }

    @Override
    public int deleteByMatchIds(Collection<Long> matchIds) {
        if (matchIds == null || matchIds.isEmpty()) {
            return 0;
        }
        String sql = inClause(DELETE_SNAPSHOTS_BY_MATCHES, matchIds.size());
        return jdbc.update(sql, matchIds.toArray());
    }

    private void update(String table, Map<String, Object> values, String where, Object... keys) {
        List<String> columns = new ArrayList<>(values.keySet());
        if (columns.isEmpty()) {
            return;
        }
        List<Object> args = new ArrayList<>();
        columns.forEach(c -> args.add(values.get(c)));
        Collections.addAll(args, keys);
        String sql = updateSql(table, columns, where);
        jdbc.update(sql, args.toArray());
    }

    private void insert(String table, Map<String, Object> row) {
        List<String> columns = new ArrayList<>(row.keySet());
        List<Object> args = new ArrayList<>();
        columns.forEach(c -> args.add(row.get(c)));
        String sql = insertSql(table, columns);
        jdbc.update(sql, args.toArray());
    }

    // Statement builders: table and column names pass identifier(); every value stays a bound "?".
    private static String updateSql(String table, List<String> columns, String where) {
        String set = columns.stream().map(c -> quote(c) + " = ?").collect(Collectors.joining(", "));
        return String.join(" ", "UPDATE", identifier(table), "SET", set, "WHERE", where);
    }

    private static String insertSql(String table, List<String> columns) {
        String names = columns.stream().map(SnapshotStoreAdapter::quote).collect(Collectors.joining(", "));
        return String.join(" ", "INSERT INTO", identifier(table), "(" + names + ")",
                "VALUES", "(" + marks(columns.size()) + ")");
    }

    private static String existingIdsSql(String table, String column, int count) {
        return String.join(" ", "SELECT", identifier(column), "FROM", identifier(table),
                "WHERE id_story = ? AND", identifier(column), "IN", "(" + marks(count) + ")");
    }

    private static String inClause(String prefix, int count) {
        return String.join("", prefix, marks(count), ")");
    }

    private static Map<String, String> perTable(Collection<String> tables, UnaryOperator<String> sql) {
        Map<String, String> out = new LinkedHashMap<>();
        tables.forEach(t -> out.put(t, sql.apply(identifier(t))));
        return Collections.unmodifiableMap(out);
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
