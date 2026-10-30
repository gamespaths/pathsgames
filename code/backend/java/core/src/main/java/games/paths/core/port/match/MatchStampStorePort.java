package games.paths.core.port.match;

import java.util.Optional;

/**
 * MatchStampStorePort - v1.7.0 reads and writes the stamp of a match: ts_update and the play_ms counter.
 */
public interface MatchStampStorePort extends MatchVersionPort {

    /** The ts_update of the match, empty when no match has the uuid. */
    Optional<String> findTsUpdate(String matchUuid);

    /** Sets ts_update and adds the delta to play_ms; false when no match has the uuid. */
    boolean stamp(String matchUuid, String tsUpdate, long playMsDelta);
}
