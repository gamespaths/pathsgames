package games.paths.core.port.match;

/**
 * MatchStampPort - v1.7.0 the stamp of a match write: a gameplay command checks the version, then claims a
 * new one before its first write (step 8); admin writes bump ts_update only and are never checked.
 */
public interface MatchStampPort {

    /** Reads the version at request start and checks If-Match (StaleMatchException); null for no match. */
    String checkGameplay(String matchUuid);

    /** Claims the next version before any other gameplay write (StaleMatchException); null for no match. */
    String claimGameplay(String matchUuid);

    void touchAdmin(String matchUuid);

    /** Gameplay check through an optional port (null in the older tests). */
    static String check(MatchStampPort port, String matchUuid) {
        return port != null ? port.checkGameplay(matchUuid) : null;
    }

    /** Gameplay claim through an optional port (null in the older tests). */
    static String claim(MatchStampPort port, String matchUuid) {
        return port != null ? port.claimGameplay(matchUuid) : null;
    }

    /** Admin stamp through an optional port (null in the older tests). */
    static void admin(MatchStampPort port, String matchUuid) {
        if (port != null) {
            port.touchAdmin(matchUuid);
        }
    }
}
