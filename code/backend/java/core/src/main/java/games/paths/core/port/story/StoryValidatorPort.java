package games.paths.core.port.story;

import games.paths.core.model.story.StoryValidationReport;

import java.util.Map;

/**
 * StoryValidatorPort - inbound port for story integrity validation (Step 22).
 *
 * <p>Three entry points share one rule engine:</p>
 * <ul>
 *   <li>{@link #validateImportData(Map)} - full-graph validation of a raw import map,
 *       run by the import service before any row is persisted (hard-fail).</li>
 *   <li>{@link #validateStory(Long)} - full-graph validation of an already-persisted
 *       story, loaded through {@code StoryReadPort}; backs the read-only validate
 *       endpoint.</li>
 *   <li>{@link #validateEntity(String, Map)} - entity-local rules only (field ranges,
 *       self-consistency), run by admin CRUD create/update; forward references are
 *       allowed so incremental authoring is not blocked.</li>
 * </ul>
 */
public interface StoryValidatorPort {

    /** Validates a raw import map (in-memory, no DB read). */
    StoryValidationReport validateImportData(Map<String, Object> storyData);

    /** Validates a persisted story by its numeric id, loading all entities. */
    StoryValidationReport validateStory(Long storyId);

    /** Validates a single entity payload against entity-local rules only. */
    StoryValidationReport validateEntity(String entityType, Map<String, Object> data);

    /**
     * Thrown by import / CRUD save paths when validation fails. The adapter layer maps
     * it to HTTP 400 with the carried {@link StoryValidationReport}. Mirrors the inline
     * exception pattern used by {@code MatchCommandPort.MatchCreationException}.
     */
    class StoryValidationException extends RuntimeException {

        private final transient StoryValidationReport report;

        public StoryValidationException(StoryValidationReport report) {
            super("Story validation failed: " + report.summary());
            this.report = report;
        }

        public StoryValidationReport getReport() {
            return report;
        }
    }
}
