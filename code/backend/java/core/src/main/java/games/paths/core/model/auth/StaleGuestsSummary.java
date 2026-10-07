package games.paths.core.model.auth;

/**
 * StaleGuestsSummary - how many guests, and how many of their matches, a stale purge covers
 * (v0.36.2). The same shape answers the dry run and the deletion, so the console can show the
 * count it is about to destroy before it destroys it.
 *
 * @param guests  guest users older than the bound
 * @param matches matches those guests created, whatever their status
 */
public record StaleGuestsSummary(long guests, long matches) {
}
