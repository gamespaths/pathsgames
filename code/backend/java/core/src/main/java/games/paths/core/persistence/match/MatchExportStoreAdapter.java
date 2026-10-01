package games.paths.core.persistence.match;

import games.paths.core.model.match.LogTable;
import games.paths.core.port.match.LogIdPort;
import games.paths.core.port.match.MatchExportStorePort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.SqlParameterValue;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Connection;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
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
 * MatchExportStoreAdapter - v0.41.4 JdbcTemplate adapter of {@link MatchExportStorePort}: SQLite and
 * PostgreSQL alike (Boolean binds, effects_json as OTHER), identifiers guarded like the snapshot store.
 */
@Repository
@Transactional
public class MatchExportStoreAdapter implements MatchExportStorePort {

    static final String MATCH_TABLE = "gaming_match";
    static final String CHARACTER_TABLE = "gaming_character_instance";
    /** Every table holding rows of a match, in a delete order the foreign keys accept. */
    static final List<String> DELETE_ORDER = List.of("log_events", "log_movements", "log_item_usage",
            "log_weather", "log_clock_history", "log_lock_history", "log_choices_executed",
            "gaming_notification_queue", "chat_messages", "gaming_trades", "gaming_movement_invites",
            "gaming_user_sessions", "gaming_active_effects", "gaming_active_choices", "gaming_temp_variables",
            "gaming_turn_queue", "gaming_story_progress", "gaming_state_registry", "gaming_state_locations",
            "gaming_character_traits", "gaming_inventory_items", "gaming_backpack_resources", "system_snapshot");
    /** Child tables whose rows carry a per-match id (max + 1) and a fresh uuid. */
    static final Set<String> PER_MATCH_ID = Set.of("gaming_character_traits", "gaming_inventory_items",
            "gaming_state_registry", "gaming_story_progress");
    private static final Set<String> USER_COLUMNS = Set.of("id", "uuid", "username", "nickname", "language",
            "state", "role", "email_address");
    private static final Pattern IDENTIFIER = Pattern.compile("[a-z_][a-z0-9_]*");
    private static final String SELECT_MATCH_ID = "SELECT id FROM gaming_match WHERE uuid = ?";

    private final JdbcTemplate jdbc;
    private final LogIdPort logIds;
    private volatile String dialect;

    public MatchExportStoreAdapter(JdbcTemplate jdbc, LogIdPort logIds) {
        this.jdbc = jdbc;
        this.logIds = logIds;
    }

    @Override
    @Transactional(readOnly = true)
    public String dialect() {
        String known = dialect;
        if (known == null) {
            known = probeDialect();
            dialect = known;
        }
        return known;
    }

    private String probeDialect() {
        try {
            return dialectOf(jdbc.execute((Connection c) -> c.getMetaData().getDatabaseProductName()));
        } catch (RuntimeException e) {
            return "sqlite";
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> logRows(long idMatch, String table, long mark) {
        String sql = "SELECT * FROM " + identifier(table) + " WHERE id_match = ? AND id <= ? ORDER BY id";
        return plainRows(jdbc.queryForList(sql, idMatch, mark));
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, Map<String, Object>> usersByIds(Collection<Long> ids) {
        Map<Long, Map<String, Object>> out = new LinkedHashMap<>();
        if (ids == null || ids.isEmpty()) {
            return out;
        }
        String sql = "SELECT * FROM users WHERE id IN (" + marks(ids.size()) + ")";
        for (Map<String, Object> row : plainRows(jdbc.queryForList(sql, ids.toArray()))) {
            out.put(((Number) row.get("id")).longValue(), safeUser(row));
        }
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> userByUuid(String uuid) {
        return plainRows(jdbc.queryForList("SELECT * FROM users WHERE uuid = ?", uuid)).stream()
                .findFirst().map(MatchExportStoreAdapter::safeUser);
    }

    /** Only the columns the export may carry: never a password, a token or the Google id. */
    static Map<String, Object> safeUser(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        row.forEach((k, v) -> {
            if (USER_COLUMNS.contains(k)) {
                out.put(k, v);
            }
        });
        return out;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> userByEmail(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        return plainRows(jdbc.queryForList("SELECT * FROM users WHERE email_address IS NOT NULL"
                + " AND LOWER(email_address) = LOWER(?) ORDER BY id", email.trim())).stream()
                .findFirst().map(MatchExportStoreAdapter::safeUser);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean usernameTaken(String username) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE username = ?", Integer.class, username);
        return n != null && n > 0;
    }

    @Override
    public long insertUser(Map<String, Object> user) {
        String now = java.time.Instant.now().toString();
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("uuid", user.get("uuid"));
        row.put("username", user.get("username"));
        row.put("nickname", user.get("nickname"));
        row.put("language", user.get("language"));
        row.put("state", user.get("state") == null ? 1 : user.get("state"));
        row.put("role", "PLAYER");
        row.put("email_address", user.get("email_address"));
        row.put("ts_registration", now);
        row.put("ts_insert", now);
        row.put("ts_update", now);
        insert("users", row);
        return jdbc.queryForObject("SELECT id FROM users WHERE uuid = ?", Long.class, user.get("uuid"));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Long> storyIdByUuid(String storyUuid) {
        return jdbc.queryForList("SELECT id FROM list_stories WHERE uuid = ?", Long.class, storyUuid)
                .stream().findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> storyUuidById(long idStory) {
        return jdbc.queryForList("SELECT uuid FROM list_stories WHERE id = ?", String.class, idStory)
                .stream().findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Long> storyLocationIds(long idStory) {
        return jdbc.queryForList("SELECT id FROM list_locations WHERE id_story = ? ORDER BY id", Long.class, idStory);
    }

    @Override
    @Transactional(readOnly = true)
    public int countMatchesOfStory(long idStory) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM gaming_match WHERE id_story = ?", Integer.class, idStory);
        return n == null ? 0 : n;
    }

    @Override
    @Transactional(readOnly = true)
    public List<Map<String, Object>> activeMatchesOf(Collection<String> userUuids, long idStory,
                                                     String excludeMatchUuid) {
        if (userUuids == null || userUuids.isEmpty()) {
            return List.of();
        }
        List<Object> args = new ArrayList<>();
        args.add(idStory);
        args.addAll(userUuids);
        args.add(excludeMatchUuid == null ? "" : excludeMatchUuid);
        String sql = "SELECT m.uuid AS uuid, m.status AS status, u.uuid AS user_uuid FROM gaming_match m"
                + " JOIN users u ON u.id = m.id_user_creator WHERE m.id_story = ? AND u.uuid IN ("
                + marks(userUuids.size()) + ") AND m.status IN ('CREATED', 'RUNNING') AND m.uuid <> ? ORDER BY m.id";
        return plainRows(jdbc.queryForList(sql, args.toArray()));
    }

    @Override
    @Transactional(readOnly = true)
    public boolean matchExists(String uuidMatch) {
        return !jdbc.queryForList(SELECT_MATCH_ID, Long.class, uuidMatch).isEmpty();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> matchOfCharacter(String characterUuid) {
        return jdbc.queryForList("SELECT m.uuid FROM gaming_character_instance c JOIN gaming_match m"
                + " ON m.id = c.id_match WHERE c.uuid = ?", String.class, characterUuid).stream().findFirst();
    }

    @Override
    public void deleteMatchFully(String uuidMatch) {
        List<Long> ids = jdbc.queryForList(SELECT_MATCH_ID, Long.class, uuidMatch);
        if (ids.isEmpty()) {
            return;
        }
        long id = ids.get(0);
        for (String table : DELETE_ORDER) {
            jdbc.update("DELETE FROM " + identifier(table) + " WHERE id_match = ?", id);
        }
        jdbc.update("UPDATE gaming_match SET id_character_current_turn = NULL WHERE id = ?", id);
        jdbc.update("DELETE FROM gaming_character_instance WHERE id_match = ?", id);
        jdbc.update("DELETE FROM gaming_match WHERE id = ?", id);
    }

    @Override
    public long insertImported(ImportRows rows) {
        if (rows.replaceUuid() != null) {
            deleteMatchFully(rows.replaceUuid());
        }
        for (Map<String, Object> user : rows.newUsers()) {
            insertUser(user);
        }
        Map<String, Object> match = withUserId(rows.match(), "id_user_creator");
        insert(MATCH_TABLE, match);
        long idMatch = jdbc.queryForObject(SELECT_MATCH_ID, Long.class, match.get("uuid"));
        for (Map<String, Object> character : rows.characters()) {
            insert(CHARACTER_TABLE, withMatch(withUserId(character, "id_user"), idMatch));
        }
        if (rows.activeOrdinal() != null) {
            jdbc.update("UPDATE gaming_match SET id_character_current_turn = ? WHERE id = ?",
                    rows.activeOrdinal(), idMatch);
        }
        rows.childRows().forEach((table, list) -> {
            long next = 1;
            for (Map<String, Object> row : list) {
                Map<String, Object> values = withMatch(row, idMatch);
                if (PER_MATCH_ID.contains(table)) {
                    values.put("id", next++);
                }
                values.put("uuid", UUID.randomUUID().toString());
                insert(table, values);
            }
        });
        for (LogInsert log : rows.logs()) {
            Map<String, Object> values = withMatch(log.columns(), idMatch);
            values.put("id", logIds.nextId(logTable(log.table())));
            values.put("uuid", UUID.randomUUID().toString());
            insert(log.table(), values);
        }
        return idMatch;
    }

    /** A user uuid in {@code column} replaced by that user's id. */
    private Map<String, Object> withUserId(Map<String, Object> row, String column) {
        Map<String, Object> out = new LinkedHashMap<>(row);
        if (out.get(column) instanceof String uuid) {
            out.put(column, jdbc.queryForObject("SELECT id FROM users WHERE uuid = ?", Long.class, uuid));
        }
        return out;
    }

    static LogTable logTable(String table) {
        return Arrays.stream(LogTable.values()).filter(t -> t.tableName().equals(table)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Not a log table: " + table));
    }

    private void insert(String table, Map<String, Object> row) {
        List<String> columns = new ArrayList<>(row.keySet());
        List<Object> args = new ArrayList<>();
        for (String c : columns) {
            Object value = row.get(c);
            // OTHER: PostgreSQL casts the text to jsonb, SQLite stores it as TEXT.
            args.add("effects_json".equals(c) && value != null ? new SqlParameterValue(Types.OTHER, value) : value);
        }
        String names = columns.stream().map(MatchExportStoreAdapter::quote).collect(Collectors.joining(", "));
        String sql = String.join(" ", "INSERT INTO", identifier(table), "(" + names + ")",
                "VALUES", "(" + marks(columns.size()) + ")");
        jdbc.update(sql, args.toArray());
    }

    private static Map<String, Object> withMatch(Map<String, Object> row, long idMatch) {
        Map<String, Object> out = new LinkedHashMap<>(row);
        out.put("id_match", idMatch);
        return out;
    }

    private static List<Map<String, Object>> plainRows(List<Map<String, Object>> rows) {
        List<Map<String, Object>> out = new ArrayList<>(rows.size());
        for (Map<String, Object> row : rows) {
            Map<String, Object> clean = new LinkedHashMap<>();
            row.forEach((column, value) -> clean.put(column.toLowerCase(Locale.ROOT), SnapshotStoreAdapter.plain(value)));
            out.add(clean);
        }
        return out;
    }

    private static String marks(int count) {
        return String.join(", ", Collections.nCopies(count, "?"));
    }

    static String identifier(String name) {
        if (name == null || !IDENTIFIER.matcher(name).matches()) {
            throw new IllegalArgumentException("Not a plain identifier: " + name);
        }
        return name;
    }

    static String quote(String name) {
        return "\"" + identifier(name) + "\"";
    }

    /** PostgreSQL or, for anything else, SQLite. */
    static String dialectOf(String product) {
        return product != null && product.toLowerCase(Locale.ROOT).contains("postgres") ? "postgresql" : "sqlite";
    }
}
