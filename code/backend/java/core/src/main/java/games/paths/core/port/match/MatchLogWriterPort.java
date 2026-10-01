package games.paths.core.port.match;

import java.util.Locale;

/**
 * MatchLogWriterPort - v0.41.1 Step 41 A: pass, trait, lifecycle and admin rows on log_events.
 * Stored with a prefix that MatchLogsService strips; none may start with EVENT_EXECUTED/CHOICE_SELECTED.
 */
public interface MatchLogWriterPort {

    /** Timeline PASS, no detail. */
    String MSG_PASS = "ACTION_PASS";
    /** {@code TRAIT_ADD <traitUuid>} → TRAIT_CHANGE {@code ADD <uuid>}. */
    String MSG_TRAIT_ADD = "TRAIT_ADD";
    /** {@code TRAIT_REMOVE <traitUuid>} → TRAIT_CHANGE {@code REMOVE <uuid>}. */
    String MSG_TRAIT_REMOVE = "TRAIT_REMOVE";
    String PREFIX_TRAIT = "TRAIT_";
    /** MATCH_CREATED / MATCH_STARTED / MATCH_ENDED → MATCH_LIFECYCLE. */
    String PREFIX_MATCH = "MATCH_";
    /** ADMIN_PAUSE, ADMIN_STATUS PAUSED, ... → ADMIN_ACTION. */
    String PREFIX_ADMIN = "ADMIN_";

    String LIFECYCLE_CREATED = "CREATED";
    String LIFECYCLE_STARTED = "STARTED";
    String LIFECYCLE_ENDED = "ENDED";

    String ADMIN_PAUSE = "PAUSE";
    String ADMIN_RESUME = "RESUME";
    String ADMIN_STOP = "STOP";
    String ADMIN_STATUS = "STATUS";
    String ADMIN_STATS = "STATS";
    /** Reserved for the snapshot restore: {@code SNAPSHOT_RESTORED clock=<n>}. */
    String ADMIN_SNAPSHOT_RESTORED = "SNAPSHOT_RESTORED";

    /** v0.41.4 - the match export ({@code EXPORTED clock=<n>}) and import ({@code IMPORTED <server> clock=<n>}). */
    String ADMIN_EXPORTED = "EXPORTED";
    String ADMIN_IMPORTED = "IMPORTED";

    /** One log_events row; character and event are null when the row belongs to the match. */
    void write(long idMatch, Long idCharacter, Long idEvent, int clock, String message);

    /** Rows of the match in every log_* table; WARNs once when it reaches game.logs.warn-rows. */
    long countRows(long idMatch);

    static String lifecycle(String detail) {
        return PREFIX_MATCH + detail;
    }

    static String admin(String detail) {
        return PREFIX_ADMIN + detail;
    }

    static String adminStatus(String status) {
        return admin(ADMIN_STATUS + " " + status.toUpperCase(Locale.ROOT));
    }

    static String snapshotRestored(int clock) {
        return admin(ADMIN_SNAPSHOT_RESTORED + " clock=" + clock);
    }

    static String exported(int clock) {
        return admin(ADMIN_EXPORTED + " clock=" + clock);
    }

    static String imported(String server, int clock) {
        return admin(ADMIN_IMPORTED + " " + server + " clock=" + clock);
    }
}
