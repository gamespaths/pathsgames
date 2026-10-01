package games.paths.core.port.story;

import java.util.Map;

/**
 * StoryExportPort - v0.41.4 Step 41 H internal story exporter: the story import JSON of a stored story,
 * the server-side twin of the react-admin export (admin only, never on the public API, decision 62).
 */
public interface StoryExportPort {

    /** The story import JSON (StoryFormat.md §1), nulls stripped; null when the story is unknown. */
    Map<String, Object> exportStory(String storyUuid);
}
