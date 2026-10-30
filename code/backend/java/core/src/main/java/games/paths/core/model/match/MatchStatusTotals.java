package games.paths.core.model.match;

/**
 * MatchStatusTotals - v1.7.0 the matches of one creator in one status: how many, their play time and clocks.
 */
public record MatchStatusTotals(String status, long matches, long playMs, long clocks) {
}
