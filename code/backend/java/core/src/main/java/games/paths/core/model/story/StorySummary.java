package games.paths.core.model.story;

/**
 * StorySummary - Domain model for a lightweight story listing entry.
 * Contains only the fields needed to display a story in a catalogue/list view.
 * Immutable record.
 */
public record StorySummary(
        String uuid,
        String title,
        String description,
        String author,
        String category,
        String group,
        String visibility,
        int priority,
        int peghi,
        int difficultyCount,
        CardInfo card) {

    public StorySummary {
        if (uuid == null || uuid.isBlank()) {
            throw new IllegalStateException("uuid is required");
        }
    }
}
