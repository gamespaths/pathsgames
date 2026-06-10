package games.paths.core.model.story;

/**
 * StoryValidationError - a single referential-integrity or domain-rule violation
 * found by the {@code StoryValidator} (Step 22).
 *
 * @param rule       the rule code that produced the error (e.g. {@code R3_EVENT_REF})
 * @param entityType the story entity type (e.g. {@code choices}, {@code events})
 * @param entityId   identifier of the offending entity within the story (may be null)
 * @param field      the field that holds the broken reference (may be null)
 * @param message    a human-readable description of the violation
 */
public record StoryValidationError(
        String rule,
        String entityType,
        String entityId,
        String field,
        String message) {
}
