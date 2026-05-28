package games.paths.core.model.story;

/**
 * ClassBonusInfo - Domain model for a single class bonus row.
 * Nested under ClassInfo to expose the {@code list_classes_bonus} rows on the
 * public API. Immutable record.
 */
public record ClassBonusInfo(String uuid, String statistic, int value) {
}
