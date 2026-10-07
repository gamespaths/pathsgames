package games.paths.core.model.auth;

import java.util.List;

/**
 * GuestInfoPage - one page of the paginated admin guest list (v0.36.2).
 *
 * @param items      the guests on this page, most recently seen first
 * @param nextCursor opaque token for the next page, or {@code null} on the last one
 * @param limit      the effective (clamped) page size that produced this page
 */
public record GuestInfoPage(List<GuestInfo> items, String nextCursor, int limit) {
}
