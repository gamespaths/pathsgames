package games.paths.adapters.admin.dto.story;

import games.paths.core.model.story.StoryValidationError;

/**
 * StoryValidationErrorResponse - one validation violation in the admin API (Step 22).
 */
public record StoryValidationErrorResponse(
        String rule,
        String entityType,
        String entityId,
        String field,
        String message) {

    public static StoryValidationErrorResponse fromModel(StoryValidationError e) {
        return new StoryValidationErrorResponse(
                e.rule(), e.entityType(), e.entityId(), e.field(), e.message());
    }
}
