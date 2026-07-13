package games.paths.adapters.rest.dto;

import java.util.List;

/**
 * PagedMatchesResponse - JSON envelope for the paginated admin match list
 * (GET /api/admin/matches, v0.28.1).
 *
 * <p>Replaces the bare {@code MatchSummaryResponse[]} so the admin console can
 * page through matches without ever reading the whole table:</p>
 *
 * <pre>{ "items": [ ...MatchSummaryResponse... ], "nextCursor": "...", "limit": 50 }</pre>
 *
 * <p>{@code nextCursor} is {@code null} on the last page; pass it back as the
 * {@code ?cursor=} query parameter to fetch the following page.</p>
 */
public class PagedMatchesResponse {

    private List<MatchSummaryResponse> items;
    private String nextCursor;
    private int limit;

    public PagedMatchesResponse() {
    }

    public PagedMatchesResponse(List<MatchSummaryResponse> items, String nextCursor, int limit) {
        this.items = items;
        this.nextCursor = nextCursor;
        this.limit = limit;
    }

    public List<MatchSummaryResponse> getItems() { return items; }
    public void setItems(List<MatchSummaryResponse> items) { this.items = items; }

    public String getNextCursor() { return nextCursor; }
    public void setNextCursor(String nextCursor) { this.nextCursor = nextCursor; }

    public int getLimit() { return limit; }
    public void setLimit(int limit) { this.limit = limit; }
}
