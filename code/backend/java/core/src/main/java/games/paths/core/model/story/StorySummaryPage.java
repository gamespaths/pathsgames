package games.paths.core.model.story;

import java.util.List;

/**
 * StorySummaryPage - v1.7.0 one page of GET /api/admin/stories: the {items, nextCursor, limit} envelope,
 * nextCursor (the position of the next page) null on the last one.
 */
public record StorySummaryPage(List<StorySummary> items, String nextCursor, int limit) {
}
