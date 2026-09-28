package games.paths.adapters.auth.persistence;

import games.paths.adapters.auth.repository.UserRepository;
import games.paths.adapters.auth.repository.UserTokenRepository;

import java.util.ArrayList;
import java.util.List;

/**
 * GuestBatchDelete - v0.41.0: deletes guests by id, tokens first, 500 ids per statement so the
 * IN list stays small on both SQLite and PostgreSQL.
 */
final class GuestBatchDelete {

    static final int CHUNK = 500;
    private static final int GUEST_STATE = 6;

    private GuestBatchDelete() {
    }

    static int deleteGuests(List<Long> ids, UserRepository users, UserTokenRepository tokens) {
        if (ids == null || ids.isEmpty()) {
            return 0;
        }
        int deleted = 0;
        for (int from = 0; from < ids.size(); from += CHUNK) {
            List<Long> chunk = new ArrayList<>(ids.subList(from, Math.min(ids.size(), from + CHUNK)));
            tokens.deleteTokensOfUsers(chunk);
            deleted += users.deleteGuestsByIds(GUEST_STATE, chunk);
        }
        return deleted;
    }

    /** Native id columns come back as Integer on SQLite and Long on PostgreSQL. */
    static List<Long> toLongs(List<Number> ids) {
        List<Long> out = new ArrayList<>();
        if (ids != null) {
            for (Number id : ids) {
                out.add(id.longValue());
            }
        }
        return out;
    }
}
