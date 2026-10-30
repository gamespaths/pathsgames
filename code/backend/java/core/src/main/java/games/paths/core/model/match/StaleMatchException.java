package games.paths.core.model.match;

/**
 * StaleMatchException - v1.7.0 step 8: a write made on an out-of-date view of the match (409 STALE_MATCH).
 */
public class StaleMatchException extends RuntimeException {

    public static final String CODE = "STALE_MATCH";

    private final String matchUuid;
    private final String currentVersion;

    public StaleMatchException(String matchUuid, String currentVersion) {
        super("The match was changed by another device: reload it");
        this.matchUuid = matchUuid;
        this.currentVersion = currentVersion;
    }

    public String getMatchUuid() {
        return matchUuid;
    }

    /** The version now stored, null when it could not be read. */
    public String getCurrentVersion() {
        return currentVersion;
    }
}
