package games.paths.core.port.match;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * MatchExportStorePort - v0.41.4 outbound port of the match export/import: the logs up to a snapshot
 * mark, users, existence checks, the full delete of replace=true and one transactional insert.
 */
public interface MatchExportStorePort {

    /** "sqlite" or "postgresql". */
    String dialect();

    /** Rows of one log_* table of the match with id <= mark, in id order (column → plain value). */
    List<Map<String, Object>> logRows(long idMatch, String table, long mark);

    /** users rows by id (uuid, username, nickname, language, state, role, email_address); never a secret. */
    Map<Long, Map<String, Object>> usersByIds(Collection<Long> ids);

    Optional<Map<String, Object>> userByUuid(String uuid);

    boolean usernameTaken(String username);

    /** v0.41.4 decision 54 - the user with this e-mail, compared case-insensitively. */
    Optional<Map<String, Object>> userByEmail(String email);

    /** A new user without password, token or Google id; answers its id. */
    long insertUser(Map<String, Object> user);

    Optional<Long> storyIdByUuid(String storyUuid);

    Optional<String> storyUuidById(long idStory);

    /** The story location ids (one gaming_state_locations row each). */
    List<Long> storyLocationIds(long idStory);

    int countMatchesOfStory(long idStory);

    /** CREATED/RUNNING matches created by these users on the story: uuid, status, creator. */
    List<Map<String, Object>> activeMatchesOf(Collection<String> userUuids, long idStory, String excludeMatchUuid);

    boolean matchExists(String uuidMatch);

    /** The uuid of the match that owns the character, if any. */
    Optional<String> matchOfCharacter(String characterUuid);

    /** Every row of the match in every table, the match last (replace=true; no status guard). */
    void deleteMatchFully(String uuidMatch);

    /**
     * One transaction: the replaced match deleted, the new users, then match, characters, child rows and
     * logs; id_user_creator / id_user hold user uuids, resolved here. Answers the new match id.
     */
    long insertImported(ImportRows rows);

    /** Native rows of an import, without ids (except the ordinals) and uuids (except match and characters). */
    record ImportRows(String replaceUuid, List<Map<String, Object>> newUsers, Map<String, Object> match,
                      List<Map<String, Object>> characters, Map<String, List<Map<String, Object>>> childRows,
                      List<LogInsert> logs, Long activeOrdinal) {
    }

    record LogInsert(String table, Map<String, Object> columns) {
    }
}
