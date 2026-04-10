package games.paths.core.port.story;

import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.ItemEntity;

import java.util.List;
import java.util.Optional;

/**
 * StoryReadPort - Outbound port for story persistence read operations.
 * Implemented by the persistence adapter to handle database reads.
 */
public interface StoryReadPort {

    /**
     * Finds all stories with a given visibility, ordered by priority descending.
     */
    List<StoryEntity> findStoriesByVisibility(String visibility);

    /**
     * Finds all stories (any visibility).
     */
    List<StoryEntity> findAllStories();

    /**
     * Finds a story by UUID.
     */
    Optional<StoryEntity> findStoryByUuid(String uuid);

    /**
     * Finds difficulties for a story.
     */
    List<StoryDifficultyEntity> findDifficultiesByStoryId(Long storyId);

    /**
     * Finds texts for a story with a specific id_text and language.
     */
    List<TextEntity> findTextsByStoryAndIdText(Long storyId, Integer idText);

    /**
     * Finds a single text by story, id_text and language.
     */
    Optional<TextEntity> findTextByStoryIdTextAndLang(Long storyId, Integer idText, String lang);

    /**
     * Counts locations for a story.
     */
    long countLocationsByStoryId(Long storyId);

    /**
     * Counts events for a story.
     */
    long countEventsByStoryId(Long storyId);

    /**
     * Counts items for a story.
     */
    long countItemsByStoryId(Long storyId);
}
