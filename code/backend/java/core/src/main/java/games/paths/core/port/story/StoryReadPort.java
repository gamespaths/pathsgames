package games.paths.core.port.story;

import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.TextEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.ItemEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.entity.story.CardEntity;
import games.paths.core.entity.story.CreatorEntity;

import java.util.List;
import java.util.Optional;

/**
 * StoryReadPort - Outbound port for story persistence read operations.
 * Implemented by the persistence adapter to handle database reads.
 *
 * <p>Enhanced in Step 15 with category/group listing, filtering,
 * and entity retrieval methods for character templates, classes, traits, and cards.</p>
 *
 * <p>Enhanced in Step 16 with card/creator lookup by UUID.</p>
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

    // === Step 15: Category and Group queries ===

    /**
     * Returns distinct category values for stories with the given visibility.
     */
    List<String> findDistinctCategoriesByVisibility(String visibility);

    /**
     * Returns distinct group values for stories with the given visibility.
     */
    List<String> findDistinctGroupsByVisibility(String visibility);

    /**
     * Finds stories filtered by category and visibility, ordered by priority descending.
     */
    List<StoryEntity> findStoriesByCategoryAndVisibility(String category, String visibility);

    /**
     * Finds stories filtered by group and visibility, ordered by priority descending.
     */
    List<StoryEntity> findStoriesByGroupAndVisibility(String group, String visibility);

    /**
     * Finds character templates for a story.
     */
    List<CharacterTemplateEntity> findCharacterTemplatesByStoryId(Long storyId);

    /**
     * Finds classes for a story.
     */
    List<ClassEntity> findClassesByStoryId(Long storyId);

    /**
     * Finds traits for a story.
     */
    List<TraitEntity> findTraitsByStoryId(Long storyId);

    /**
     * Finds a card by story ID and card primary key.
     */
    Optional<CardEntity> findCardByStoryIdAndCardId(Long storyId, Long cardId);

    // === Step 16: Card and Creator lookup by UUID ===

    /**
     * Finds a card by story ID and card UUID.
     */
    Optional<CardEntity> findCardByStoryIdAndUuid(Long storyId, String uuid);

    /**
     * Finds a creator by story ID and creator UUID.
     */
    Optional<CreatorEntity> findCreatorByStoryIdAndUuid(Long storyId, String uuid);

    /**
     * Finds all creators for a story.
     */
    java.util.List<CreatorEntity> findCreatorsByStoryId(Long storyId);

    // === Step 17: CRUD lookup methods for all entity types ===

    /** Finds a difficulty by story ID and UUID. */
    Optional<StoryDifficultyEntity> findDifficultyByStoryIdAndUuid(Long storyId, String uuid);

    /** Finds a location by story ID and UUID. */
    Optional<LocationEntity> findLocationByStoryIdAndUuid(Long storyId, String uuid);

    /** Finds all locations for a story. */
    List<LocationEntity> findLocationsByStoryId(Long storyId);

    /** Finds an event by story ID and UUID. */
    Optional<EventEntity> findEventByStoryIdAndUuid(Long storyId, String uuid);

    /** Finds all events for a story. */
    List<EventEntity> findEventsByStoryId(Long storyId);

    /** Finds an item by story ID and UUID. */
    Optional<ItemEntity> findItemByStoryIdAndUuid(Long storyId, String uuid);

    /** Finds all items for a story. */
    List<ItemEntity> findItemsByStoryId(Long storyId);

    /** Finds a character template by story ID and UUID. */
    Optional<CharacterTemplateEntity> findCharacterTemplateByStoryIdAndUuid(Long storyId, String uuid);

    /** Finds a class by story ID and UUID. */
    Optional<ClassEntity> findClassByStoryIdAndUuid(Long storyId, String uuid);

    /** Finds a trait by story ID and UUID. */
    Optional<TraitEntity> findTraitByStoryIdAndUuid(Long storyId, String uuid);

    /** Finds a text by story ID and UUID. */
    Optional<TextEntity> findTextByStoryIdAndUuid(Long storyId, String uuid);

    /** Finds all texts for a story. */
    List<TextEntity> findTextsByStoryId(Long storyId);

    /** Finds all cards for a story. */
    List<CardEntity> findCardsByStoryId(Long storyId);
}
