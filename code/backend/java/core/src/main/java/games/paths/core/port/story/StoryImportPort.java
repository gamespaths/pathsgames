package games.paths.core.port.story;

import games.paths.core.model.story.StoryImportResult;

import java.util.Map;
import java.util.List;

/**
 * StoryImportPort - Inbound port for importing and managing stories.
 * Part of the Hexagonal Architecture: this is a domain port
 * that the adapter-admin module will call for story administration.
 */
public interface StoryImportPort {

    /**
     * Imports a complete story from a structured data map.
     * The map contains the story header plus nested lists for all sub-entities
     * (texts, locations, events, items, classes, choices, difficulties, etc.).
     *
     * <p>If the story already exists (by UUID), it will be replaced entirely.</p>
     *
     * @param storyData the story data as a structured map
     * @return the import result with counts of imported entities
     */
    StoryImportResult importStory(Map<String, Object> storyData);

    /**
     * Deletes a story and all its related data by UUID.
     *
     * @param uuid the story UUID
     * @return true if the story existed and was deleted, false otherwise
     */
    boolean deleteStory(String uuid);

    /**
     * Returns the UUIDs of all stories currently stored.
     *
     * @return list of story UUIDs
     */
    List<String> listStoryUuids();
}
