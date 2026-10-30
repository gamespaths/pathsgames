package games.paths.core.port.match;

/**
 * MatchVersionPort - v1.7.0 step 8 the conditional claim of a match version, one statement committed on
 * its own: ts_update moves from old to new and play_ms grows, only if ts_update still equals old.
 */
public interface MatchVersionPort {

    /** True when the row still had the old version and now has the new one; false when another write won. */
    boolean claim(String matchUuid, String oldVersion, String newVersion, long playMsDelta);
}
