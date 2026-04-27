package games.paths.core.port.story;

import games.paths.core.entity.story.*;

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

    /** Finds a location-neighbor by story ID and UUID. */
    Optional<LocationNeighborEntity> findLocationNeighborByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all location-neighbors for a story. */
    List<LocationNeighborEntity> findLocationNeighborsByStoryId(Long storyId);

    /** Finds a key by story ID and UUID. */
    Optional<KeyEntity> findKeyByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all keys for a story. */
    List<KeyEntity> findKeysByStoryId(Long storyId);

    /** Finds an event-effect by story ID and UUID. */
    Optional<EventEffectEntity> findEventEffectByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all event-effects for a story. */
    List<EventEffectEntity> findEventEffectsByStoryId(Long storyId);

    /** Finds a choice by story ID and UUID. */
    Optional<ChoiceEntity> findChoiceByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all choices for a story. */
    List<ChoiceEntity> findChoicesByStoryId(Long storyId);

    /** Finds a choice-condition by story ID and UUID. */
    Optional<ChoiceConditionEntity> findChoiceConditionByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all choice-conditions for a story. */
    List<ChoiceConditionEntity> findChoiceConditionsByStoryId(Long storyId);

    /** Finds a choice-effect by story ID and UUID. */
    Optional<ChoiceEffectEntity> findChoiceEffectByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all choice-effects for a story. */
    List<ChoiceEffectEntity> findChoiceEffectsByStoryId(Long storyId);

    /** Finds an item-effect by story ID and UUID. */
    Optional<ItemEffectEntity> findItemEffectByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all item-effects for a story. */
    List<ItemEffectEntity> findItemEffectsByStoryId(Long storyId);

    /** Finds a weather-rule by story ID and UUID. */
    Optional<WeatherRuleEntity> findWeatherRuleByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all weather-rules for a story. */
    List<WeatherRuleEntity> findWeatherRulesByStoryId(Long storyId);

    /** Finds a global-random-event by story ID and UUID. */
    Optional<GlobalRandomEventEntity> findGlobalRandomEventByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all global-random-events for a story. */
    List<GlobalRandomEventEntity> findGlobalRandomEventsByStoryId(Long storyId);

    /** Finds a class-bonus by story ID and UUID. */
    Optional<ClassBonusEntity> findClassBonusByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all class-bonuses for a story. */
    List<ClassBonusEntity> findClassBonusesByStoryId(Long storyId);

    /** Finds a mission by story ID and UUID. */
    Optional<MissionEntity> findMissionByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all missions for a story. */
    List<MissionEntity> findMissionsByStoryId(Long storyId);

    /** Finds a mission-step by story ID and UUID. */
    Optional<MissionStepEntity> findMissionStepByStoryIdAndUuid(Long storyId, String uuid);
    /** Finds all mission-steps for a story. */
    List<MissionStepEntity> findMissionStepsByStoryId(Long storyId);
}
