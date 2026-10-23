package games.paths.core.service.match;

import games.paths.core.model.match.MatchStatuses;
import games.paths.core.model.match.MatchSummary;
import games.paths.core.model.match.MatchSummaryPage;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * MatchListOrder - v1.7.0 step 9 the player's match list: active matches first, then last played (ts_update),
 * paged in memory; the cursor is the position of the next page in the sorted list.
 */
public final class MatchListOrder {

    public static final int DEFAULT_LIMIT = 50;
    public static final int MAX_LIMIT = 200;

    private static final Comparator<MatchSummary> ORDER = Comparator
            .comparingInt((MatchSummary m) -> MatchStatuses.isActive(m.getStatus()) ? 0 : 1)
            .thenComparing(Comparator.comparingLong(MatchListOrder::lastPlayed).reversed())
            .thenComparing(Comparator.comparingLong((MatchSummary m) -> epoch(m.getTsInsert())).reversed())
            .thenComparing(m -> m.getUuid() != null ? m.getUuid() : "");

    private MatchListOrder() {
    }

    /** A sorted copy: active (CREATED, RUNNING, PAUSED) first, then the latest ts_update. */
    public static List<MatchSummary> sort(List<MatchSummary> matches) {
        List<MatchSummary> sorted = new ArrayList<>(matches != null ? matches : List.of());
        sorted.sort(ORDER);
        return sorted;
    }

    /** One page of the sorted list; nextCursor is null on the last page. */
    public static MatchSummaryPage page(List<MatchSummary> matches, Integer limit, String cursor) {
        List<MatchSummary> sorted = sort(matches);
        int size = clampLimit(limit);
        int from = Math.min(offsetOf(cursor), sorted.size());
        int to = Math.min(from + size, sorted.size());
        String next = to < sorted.size() ? String.valueOf(to) : null;
        return new MatchSummaryPage(new ArrayList<>(sorted.subList(from, to)), next, size);
    }

    public static int clampLimit(Integer requested) {
        if (requested == null) {
            return DEFAULT_LIMIT;
        }
        return Math.max(1, Math.min(requested, MAX_LIMIT));
    }

    /** The position carried by the cursor; 0 (first page) when missing or unreadable. */
    public static int offsetOf(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(cursor.trim()));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static long lastPlayed(MatchSummary m) {
        long played = epoch(m.getTsUpdate());
        return played != 0L ? played : epoch(m.getTsInsert());
    }

    private static long epoch(String ts) {
        Instant parsed = MatchStampService.parse(ts);
        return parsed != null ? parsed.toEpochMilli() : 0L;
    }
}
