package games.paths.adapters.auth.persistence;

import games.paths.core.model.auth.MatchOwnership;
import games.paths.core.model.match.MatchStatuses;
import games.paths.core.port.auth.GuestMergePersistencePort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

/**
 * GuestMergePersistenceAdapter - v1.2.0 the guest merge in one SQL transaction: matches and characters
 * move to the Google user (ts_update kept), losers become CANCELLED, the guest and its tokens go.
 */
@Repository
@Transactional
public class GuestMergePersistenceAdapter implements GuestMergePersistencePort {

    private static final int GUEST_STATE = 6;

    private final JdbcTemplate jdbc;

    public GuestMergePersistenceAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public List<MatchOwnership> matchesOfUser(long userId) {
        return jdbc.query("SELECT id, uuid, id_story, status, ts_update FROM gaming_match WHERE id_user_creator = ?"
                        + " ORDER BY id",
                (rs, n) -> new MatchOwnership(rs.getLong("id"), rs.getString("uuid"), rs.getLong("id_story"),
                        rs.getString("status"), rs.getString("ts_update")), userId);
    }

    @Override
    public int applyMerge(long guestUserId, long targetUserId, List<Long> cancelMatchIds, String now) {
        int moved = jdbc.update("UPDATE gaming_match SET id_user_creator = ? WHERE id_user_creator = ?",
                targetUserId, guestUserId);
        jdbc.update("UPDATE gaming_character_instance SET id_user = ? WHERE id_user = ?", targetUserId, guestUserId);
        for (Long id : cancelMatchIds == null ? Collections.<Long>emptyList() : cancelMatchIds) {
            jdbc.update("UPDATE gaming_match SET status = ?, ts_update = ? WHERE id = ?",
                    MatchStatuses.CANCELLED, now, id);
        }
        jdbc.update("DELETE FROM users_tokens WHERE id_user = ?", guestUserId);
        jdbc.update("DELETE FROM gaming_user_sessions WHERE id_user = ?", guestUserId);
        jdbc.update("DELETE FROM chat_messages WHERE id_user = ?", guestUserId);
        jdbc.update("DELETE FROM users_identities WHERE id_user = ?", guestUserId);
        jdbc.update("DELETE FROM users WHERE id = ? AND state = ?", guestUserId, GUEST_STATE);
        return moved;
    }
}
