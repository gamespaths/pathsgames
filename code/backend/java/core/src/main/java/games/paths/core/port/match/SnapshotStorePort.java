package games.paths.core.port.match;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * SnapshotStorePort - v0.41.1 outbound port of the match snapshots: the system_snapshot rows,
 * the match state they copy (one list of column maps per table) and the log cut of a restore.
 */
public interface SnapshotStorePort {

    Optional<MatchRef> findMatchByUuid(String uuidMatch);

    Optional<MatchRef> findMatchById(long idMatch);

    /** Every state table of the match: gaming_match (one row), the characters and their child rows. */
    Map<String, List<Map<String, Object>>> readState(long idMatch);

    /** The highest log id of the match in every log_* table (0 when it has none). */
    Map<String, Long> logMarks(long idMatch);

    void insert(NewSnapshot snapshot);

    /** Newest first, without the payload. */
    List<StoredSnapshot> list(long idMatch);

    /** One snapshot of the match with its payload and checksum. */
    Optional<StoredSnapshot> find(long idMatch, String uuidSnapshot);

    /** Keeps the newest {@code keep} snapshots of the match; answers how many were deleted. */
    int prune(long idMatch, int keep);

    /** Which of {@code ids} the story still holds in {@code table.column}. */
    Set<Long> existingStoryIds(String table, String column, long idStory, Collection<Long> ids);

    Set<Long> existingUserIds(Collection<Long> ids);

    /** One transaction: log cut above the marks, rows put back, newer snapshots dropped; answers the log rows removed. */
    long restore(long idMatch, long idSnapshot, Map<String, List<Map<String, Object>>> state,
                 Map<String, Long> logMarks);

    void setStatus(long idMatch, String status);

    /** The snapshots of deleted matches: SQLite does not enforce the ON DELETE CASCADE. */
    int deleteByMatchIds(Collection<Long> matchIds);

    record MatchRef(long id, String uuid, long idStory, String status, int currentClock) {
    }

    record NewSnapshot(long idMatch, long idStory, int clock, String type, String payload,
                       String checksum, String description) {
    }

    record StoredSnapshot(long id, String uuid, int clock, String type, String timestamp,
                          String description, long sizeBytes, String payload, String checksum) {
    }
}
