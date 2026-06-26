package games.paths.core.model.match;

import java.util.List;

/**
 * MatchSummaryPage - one page of the paginated admin match list (v0.28.1).
 *
 * @param items      the match summaries on this page, newest first
 * @param nextCursor opaque token to fetch the next page, or {@code null} when
 *                   this is the last page
 * @param limit      the effective (clamped) page size that produced this page
 */
public record MatchSummaryPage(List<MatchSummary> items, String nextCursor, int limit) {
}
