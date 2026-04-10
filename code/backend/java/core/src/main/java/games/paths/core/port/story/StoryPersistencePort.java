package games.paths.core.port.story;

import games.paths.core.entity.story.*;

import java.util.List;
import java.util.Optional;

/**
 * StoryPersistencePort - Outbound port for story persistence write operations.
 * Implemented by the persistence adapter to handle database writes.
 */
public interface StoryPersistencePort {

    /**
     * Saves a story entity and returns the persisted entity with generated ID.
     */
    StoryEntity saveStory(StoryEntity entity);

    /**
     * Deletes all data associated with a story (cascading through all sub-tables).
     *
     * @param storyId the story database ID
     */
    void deleteStoryData(Long storyId);

    /**
     * Finds a story by UUID.
     */
    Optional<StoryEntity> findStoryByUuid(String uuid);

    /**
     * Saves a list of text entities.
     */
    List<TextEntity> saveTexts(List<TextEntity> texts);

    /**
     * Saves a list of difficulty entities.
     */
    List<StoryDifficultyEntity> saveDifficulties(List<StoryDifficultyEntity> difficulties);

    /**
     * Saves a list of creator entities.
     */
    List<CreatorEntity> saveCreators(List<CreatorEntity> creators);

    /**
     * Saves a list of card entities.
     */
    List<CardEntity> saveCards(List<CardEntity> cards);

    /**
     * Saves a list of key entities.
     */
    List<KeyEntity> saveKeys(List<KeyEntity> keys);

    /**
     * Saves a list of class entities.
     */
    List<ClassEntity> saveClasses(List<ClassEntity> classes);

    /**
     * Saves a list of class bonus entities.
     */
    List<ClassBonusEntity> saveClassBonuses(List<ClassBonusEntity> bonuses);

    /**
     * Saves a list of trait entities.
     */
    List<TraitEntity> saveTraits(List<TraitEntity> traits);

    /**
     * Saves a list of character template entities.
     */
    List<CharacterTemplateEntity> saveCharacterTemplates(List<CharacterTemplateEntity> templates);

    /**
     * Saves a list of location entities.
     */
    List<LocationEntity> saveLocations(List<LocationEntity> locations);

    /**
     * Saves a list of location neighbor entities.
     */
    List<LocationNeighborEntity> saveLocationNeighbors(List<LocationNeighborEntity> neighbors);

    /**
     * Saves a list of item entities.
     */
    List<ItemEntity> saveItems(List<ItemEntity> items);

    /**
     * Saves a list of item effect entities.
     */
    List<ItemEffectEntity> saveItemEffects(List<ItemEffectEntity> effects);

    /**
     * Saves a list of weather rule entities.
     */
    List<WeatherRuleEntity> saveWeatherRules(List<WeatherRuleEntity> rules);

    /**
     * Saves a list of event entities.
     */
    List<EventEntity> saveEvents(List<EventEntity> events);

    /**
     * Saves a list of event effect entities.
     */
    List<EventEffectEntity> saveEventEffects(List<EventEffectEntity> effects);

    /**
     * Saves a list of choice entities.
     */
    List<ChoiceEntity> saveChoices(List<ChoiceEntity> choices);

    /**
     * Saves a list of choice condition entities.
     */
    List<ChoiceConditionEntity> saveChoiceConditions(List<ChoiceConditionEntity> conditions);

    /**
     * Saves a list of choice effect entities.
     */
    List<ChoiceEffectEntity> saveChoiceEffects(List<ChoiceEffectEntity> effects);

    /**
     * Saves a list of global random event entities.
     */
    List<GlobalRandomEventEntity> saveGlobalRandomEvents(List<GlobalRandomEventEntity> events);

    /**
     * Saves a list of mission entities.
     */
    List<MissionEntity> saveMissions(List<MissionEntity> missions);

    /**
     * Saves a list of mission step entities.
     */
    List<MissionStepEntity> saveMissionSteps(List<MissionStepEntity> steps);
}
