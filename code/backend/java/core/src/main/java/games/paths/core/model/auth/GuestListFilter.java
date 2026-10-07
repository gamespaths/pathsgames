package games.paths.core.model.auth;

/**
 * GuestListFilter - raw request inputs for the paginated admin guest list (v0.36.2).
 *
 * <p>Before it the console asked for every guest at once, which on the AWS backend is a
 * full-table scan and timed out at 15s. Any {@code null} field means "no filter".</p>
 *
 * @param olderThanDays only guests whose last access (or registration) is older than N days
 * @param cursor        opaque token from a previous page's {@code nextCursor}
 * @param limit         requested page size (clamped by the service)
 */
public record GuestListFilter(Integer olderThanDays, String cursor, Integer limit) {
}
