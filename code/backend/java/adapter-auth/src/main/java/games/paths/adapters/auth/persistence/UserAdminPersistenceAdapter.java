package games.paths.adapters.auth.persistence;

import games.paths.core.model.auth.AdminUserItem;
import games.paths.core.model.auth.UserStates;
import games.paths.core.port.auth.UserAdminPersistencePort;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * UserAdminPersistenceAdapter - v1.7.0 {@link UserAdminPersistencePort} with plain SQL valid on SQLite and
 * PostgreSQL: keyset pages on (lower(nickname), uuid) and (ts_last_access, uuid), banned-subject hashes.
 */
@Repository
@Transactional
public class UserAdminPersistenceAdapter implements UserAdminPersistencePort {

    static final String COLUMNS = "SELECT u.id, u.uuid, u.nickname, u.state, u.role, u.ts_registration,"
            + " u.ts_last_access, u.suspended_until, (SELECT COUNT(*) FROM users_identities i"
            + " WHERE i.id_user = u.id AND i.provider = 'GOOGLE') AS google FROM users u";
    static final String NICK = "COALESCE(lower(u.nickname), '')";
    static final String ACCESS = "COALESCE(u.ts_last_access, '')";

    static final RowMapper<AdminUserItem> ITEM = (rs, n) -> new AdminUserItem(rs.getLong("id"),
            rs.getString("uuid"), rs.getString("nickname"), rs.getInt("state"), rs.getString("role"),
            rs.getLong("google") > 0 ? AdminUserItem.TYPE_GOOGLE : AdminUserItem.TYPE_INTERNAL,
            rs.getString("ts_registration"), rs.getString("ts_last_access"), rs.getString("suspended_until"));

    // v1.8.0 — one constant query per column: no SQL text is built at run time
    private static final String COUNT_BY_HASH_SUB = "SELECT COUNT(*) FROM users_banned_subjects WHERE hash_sub = ?";
    private static final String COUNT_BY_HASH_EMAIL =
            "SELECT COUNT(*) FROM users_banned_subjects WHERE hash_email = ?";

    private final JdbcTemplate jdbc;

    public UserAdminPersistenceAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminUserItem> listByNickname(Integer state, String prefix, String afterNickname, String afterUuid,
                                              int limit) {
        StringBuilder sql = new StringBuilder(COLUMNS).append(" WHERE u.state <> ").append(UserStates.GUEST);
        List<Object> args = new ArrayList<>();
        if (state != null) {
            sql.append(" AND u.state = ?");
            args.add(state);
        }
        if (prefix != null && !prefix.isEmpty()) {
            sql.append(" AND ").append(NICK).append(" LIKE ? ESCAPE '\\'");
            args.add(escapeLike(prefix) + "%");
        }
        if (afterNickname != null && afterUuid != null) {
            sql.append(" AND (").append(NICK).append(" > ? OR (").append(NICK).append(" = ? AND u.uuid > ?))");
            args.add(afterNickname);
            args.add(afterNickname);
            args.add(afterUuid);
        }
        sql.append(" ORDER BY ").append(NICK).append(", u.uuid LIMIT ?");
        args.add(limit);
        return jdbc.query(sql.toString(), ITEM, args.toArray());
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminUserItem> listByLastAccess(int state, String afterAccess, String afterUuid, int limit) {
        StringBuilder sql = new StringBuilder(COLUMNS).append(" WHERE u.state = ?");
        List<Object> args = new ArrayList<>(List.of(state));
        if (afterAccess != null && afterUuid != null) {
            sql.append(" AND (").append(ACCESS).append(" < ? OR (").append(ACCESS).append(" = ? AND u.uuid < ?))");
            args.add(afterAccess);
            args.add(afterAccess);
            args.add(afterUuid);
        }
        sql.append(" ORDER BY ").append(ACCESS).append(" DESC, u.uuid DESC LIMIT ?");
        args.add(limit);
        return jdbc.query(sql.toString(), ITEM, args.toArray());
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AdminUserItem> findByEmail(String email) {
        return first(jdbc.query(COLUMNS + " WHERE u.email_address = ? AND u.state <> " + UserStates.GUEST,
                ITEM, email));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<AdminUserItem> findByUuid(String uuid) {
        return first(jdbc.query(COLUMNS + " WHERE u.uuid = ?", ITEM, uuid));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<String> findEmail(long userId) {
        return first(jdbc.queryForList("SELECT email_address FROM users WHERE id = ?", String.class, userId))
                .filter(e -> !e.isBlank());
    }

    @Override
    public void updateStateAndSuspension(long userId, int state, String suspendedUntil) {
        jdbc.update("UPDATE users SET state = ?, suspended_until = ?, ts_update = ? WHERE id = ?", state,
                suspendedUntil, Instant.now().toString(), userId);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isRelinkPending(long userId) {
        List<Integer> rows = jdbc.queryForList("SELECT relink_pending FROM users WHERE id = ?", Integer.class, userId);
        return !rows.isEmpty() && rows.get(0) != null && rows.get(0) == 1;
    }

    @Override
    public void setRelinkPending(long userId, boolean pending) {
        jdbc.update("UPDATE users SET relink_pending = ? WHERE id = ?", pending ? 1 : 0, userId);
    }

    @Override
    public void replaceIdentitySubject(long identityId, long userId, String subject) {
        jdbc.update("UPDATE users_identities SET provider_subject = ?, ts_update = ? WHERE id = ?", subject,
                Instant.now().toString(), identityId);
        setRelinkPending(userId, false);
    }

    @Override
    public void storeBannedHashes(String userUuid, String hashSub, String hashEmail) {
        deleteBannedHashes(userUuid);
        String sub = hashSub != null && countHash(COUNT_BY_HASH_SUB, hashSub) == 0 ? hashSub : null;
        String email = hashEmail != null && countHash(COUNT_BY_HASH_EMAIL, hashEmail) == 0 ? hashEmail : null;
        if (sub == null && email == null) {
            return;
        }
        jdbc.update("INSERT INTO users_banned_subjects (uuid, hash_sub, hash_email, ts_insert) VALUES (?, ?, ?, ?)"
                + " ON CONFLICT DO NOTHING", userUuid, sub, email, Instant.now().toString());
    }

    @Override
    public int deleteBannedHashes(String userUuid) {
        return jdbc.update("DELETE FROM users_banned_subjects WHERE uuid = ?", userUuid);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasBannedHashes(String userUuid) {
        Integer n = jdbc.queryForObject("SELECT COUNT(*) FROM users_banned_subjects WHERE uuid = ?", Integer.class,
                userUuid);
        return n != null && n > 0;
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isBanned(String hashSub, String hashEmail) {
        return (hashSub != null && countHash(COUNT_BY_HASH_SUB, hashSub) > 0)
                || (hashEmail != null && countHash(COUNT_BY_HASH_EMAIL, hashEmail) > 0);
    }

    private int countHash(String query, String hash) {
        Integer n = jdbc.queryForObject(query, Integer.class, hash);
        return n == null ? 0 : n;
    }

    static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static <T> Optional<T> first(List<T> rows) {
        return rows.isEmpty() ? Optional.empty() : Optional.ofNullable(rows.get(0));
    }
}
