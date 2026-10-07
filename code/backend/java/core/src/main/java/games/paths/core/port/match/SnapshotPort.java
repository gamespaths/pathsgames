package games.paths.core.port.match;

import java.util.List;

/**
 * SnapshotPort - v0.41.1 Step 41 B: the LIGHT match snapshots written at every time-end and
 * the admin list, integrity check and restore of them (decisions 3, 4, 16, 18).
 */
public interface SnapshotPort {

    String TYPE_LIGHT = "LIGHT";
    String STATUS_RESTORED = "RESTORED";

    String CHECKSUM_MISMATCH = "SNAPSHOT_CHECKSUM_MISMATCH";
    String VERSION_UNKNOWN = "SNAPSHOT_VERSION_UNKNOWN";
    String STORY_ENTITY_MISSING = "STORY_ENTITY_MISSING";
    String USER_MISSING = "USER_MISSING";
    String MATCH_MISMATCH = "MATCH_MISMATCH";

    /** The snapshots of a match, newest first. */
    List<SnapshotSummary> list(String uuidMatch);

    /** Verifies a snapshot without writing anything. */
    SnapshotCheck check(String uuidMatch, String uuidSnapshot);

    /** Rolls the match back to the snapshot, runs the time-start and leaves it PAUSED. */
    RestoreResult restore(String uuidMatch, String uuidSnapshot);

    /** The hook the time engine calls first at every time-end, before the clock moves. */
    interface TimeEndWriter {
        void writeAtTimeEnd(long idMatch);
    }

    record SnapshotSummary(String uuid, int clock, String type, String timestamp,
                           String description, long sizeBytes) {
    }

    record CheckError(String code, String message) {
    }

    record SnapshotCheck(boolean valid, List<CheckError> errors) {
    }

    record RestoreResult(String status, String uuidSnapshot, int clock, String matchStatus,
                         long logsRemoved) {
    }

    class SnapshotException extends RuntimeException {
        public enum Code {
            MATCH_NOT_FOUND,
            SNAPSHOT_NOT_FOUND,
            SNAPSHOT_INTEGRITY_FAILED
        }

        private final transient Code code;
        private final transient List<CheckError> errors;

        public SnapshotException(Code code, String message) {
            this(code, message, List.of());
        }

        public SnapshotException(Code code, String message, List<CheckError> errors) {
            super(message);
            this.code = code;
            this.errors = errors == null ? List.of() : List.copyOf(errors);
        }

        public Code getCode() {
            return code;
        }

        public List<CheckError> getErrors() {
            return errors;
        }
    }
}
