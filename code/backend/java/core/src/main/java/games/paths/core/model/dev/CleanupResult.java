package games.paths.core.model.dev;

/**
 * CleanupResult - immutable summary of a dev-only test-data cleanup operation.
 *
 * @param deletedGuests  number of guest users removed
 * @param deletedMatches number of matches removed
 */
public record CleanupResult(int deletedGuests, int deletedMatches) {
}
