package games.paths.core.port.match;

import java.util.List;
import java.util.Map;

/**
 * MatchExportPort - v0.41.4 Step 41 H: the neutral "match export v1" file of a match (export) and its
 * dry-run check and import on any backend (decisions 45-66). Admin only.
 */
public interface MatchExportPort {

    String FORMAT = "paths-games-match-export";
    int FORMAT_VERSION = 1;

    String MODE_AUTO = "AUTO";
    String MODE_KEEP = "KEEP";
    String MODE_REPLACE = "REPLACE";

    // check errors
    String CHECKSUM_MISMATCH = "CHECKSUM_MISMATCH";
    String FORMAT_UNKNOWN = "FORMAT_UNKNOWN";
    String SCHEMA_INVALID = "SCHEMA_INVALID";
    String REFERENCE_INVALID = "REFERENCE_INVALID";
    String STORY_INVALID = "STORY_INVALID";
    String STORY_DIFFERS = "STORY_DIFFERS";
    String STORY_ENTITY_MISSING = "STORY_ENTITY_MISSING";
    String MATCH_EXISTS = "MATCH_EXISTS";
    String CHARACTER_EXISTS = "CHARACTER_EXISTS";

    // check warnings
    String APP_VERSION_DIFFERS = "APP_VERSION_DIFFERS";
    String CROSS_FAMILY = "CROSS_FAMILY";
    String USERNAME_RENAMED = "USERNAME_RENAMED";
    /** Decision 54 (revised): a new user matched by e-mail onto an existing one of the target. */
    String USER_MAPPED_BY_EMAIL = "USER_MAPPED_BY_EMAIL";
    String ROLE_DOWNGRADED = "ROLE_DOWNGRADED";
    String USER_HAS_ACTIVE_MATCH = "USER_HAS_ACTIVE_MATCH";
    String STORY_MATCHES_DELETED = "STORY_MATCHES_DELETED";
    String MARKERS_RECONCILED = "MARKERS_RECONCILED";
    String VISITED_LOCATIONS_DIFFER = "VISITED_LOCATIONS_DIFFER";
    String ACTIVE_CHOICES_IGNORED = "ACTIVE_CHOICES_IGNORED";

    /** POST .../{uuid}/export: pause, latest snapshot, file, restore, restart (decision 45). */
    ExportResult exportMatch(String uuidMatch);

    /** POST /api/admin/matches/import with dryRun=true: the MatchImportCheck, nothing written. */
    Map<String, Object> check(Map<String, Object> request);

    /** POST /api/admin/matches/import: the MatchImportResponse (201). */
    Map<String, Object> importMatch(Map<String, Object> request);

    /** The file: the document, its canonical text and the attachment name. */
    record ExportResult(Map<String, Object> document, String canonical, String fileName) {
    }

    record Issue(String code, String message) {
    }

    class MatchExportException extends RuntimeException {
        public enum Code {
            MATCH_NOT_FOUND(404),
            NO_SNAPSHOT(409),
            SNAPSHOT_INTEGRITY_FAILED(409),
            EXPORT_TOO_LARGE(413),
            IMPORT_TOO_LARGE(413),
            IMPORT_INVALID(422),
            MATCH_EXISTS(409),
            STORY_DIFFERS(409),
            CHARACTER_EXISTS(409),
            IMPORT_TIME_START_FAILED(500);

            private final int status;

            Code(int status) {
                this.status = status;
            }

            public int status() {
                return status;
            }
        }

        private final transient Code code;
        private final transient List<Issue> errors;

        public MatchExportException(Code code, String message) {
            this(code, message, List.of());
        }

        public MatchExportException(Code code, String message, List<Issue> errors) {
            super(message);
            this.code = code;
            this.errors = errors == null ? List.of() : List.copyOf(errors);
        }

        public Code getCode() {
            return code;
        }

        public List<Issue> getErrors() {
            return errors;
        }
    }
}
