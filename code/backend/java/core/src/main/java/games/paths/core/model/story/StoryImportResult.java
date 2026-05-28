package games.paths.core.model.story;

/**
 * StoryImportResult - Domain model for the result of a story import operation.
 * Reports the counts of entities imported per category. Immutable record.
 */
public record StoryImportResult(
        String storyUuid,
        String status,
        int textsImported,
        int locationsImported,
        int eventsImported,
        int itemsImported,
        int difficultiesImported,
        int classesImported,
        int choicesImported) {

    public StoryImportResult {
        if (storyUuid == null || storyUuid.isBlank()) {
            throw new IllegalStateException("storyUuid is required");
        }
        if (status == null || status.isBlank()) {
            throw new IllegalStateException("status is required");
        }
    }
}
