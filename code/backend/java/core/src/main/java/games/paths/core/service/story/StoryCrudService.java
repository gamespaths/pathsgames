package games.paths.core.service.story;

import games.paths.core.entity.story.*;
import games.paths.core.port.story.StoryCrudPort;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.port.story.StoryReadPort;

import java.util.*;
import java.util.stream.Collectors;

/**
 * StoryCrudService - Domain service implementing admin CRUD for all 22 story
 * entity types.
 * Step 17: Provides create, read, update, delete for every story sub-table.
 * All entity fields are fully mapped for complete editability.
 */
public class StoryCrudService implements StoryCrudPort {

    private final StoryReadPort readPort;
    private final StoryPersistencePort persistencePort;

    public StoryCrudService(StoryReadPort readPort, StoryPersistencePort persistencePort) {
        this.readPort = readPort;
        this.persistencePort = persistencePort;
    }

    @Override
    public List<Map<String, Object>> listEntities(String storyUuid, String entityType) {
        if (isBlank(storyUuid) || isBlank(entityType))
            return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty())
            return null;
        Long sid = storyOpt.get().getId();
        return listByType(sid, entityType);
    }

    @Override
    public Map<String, Object> getEntity(String storyUuid, String entityType, String entityUuid) {
        if (isBlank(storyUuid) || isBlank(entityType) || isBlank(entityUuid))
            return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty())
            return null;
        Long sid = storyOpt.get().getId();
        return getByType(sid, entityType, entityUuid);
    }

    @Override
    public Map<String, Object> createEntity(String storyUuid, String entityType, Map<String, Object> data) {
        if (isBlank(storyUuid) || isBlank(entityType) || data == null || data.isEmpty())
            return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty())
            return null;
        Long sid = storyOpt.get().getId();
        return createByType(sid, entityType, data);
    }

    @Override
    public Map<String, Object> updateEntity(String storyUuid, String entityType, String entityUuid,
            Map<String, Object> data) {
        if (isBlank(storyUuid) || isBlank(entityType) || isBlank(entityUuid) || data == null || data.isEmpty())
            return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty())
            return null;
        Long sid = storyOpt.get().getId();
        return updateByType(sid, entityType, entityUuid, data);
    }

    @Override
    public boolean deleteEntity(String storyUuid, String entityType, String entityUuid) {
        if (isBlank(storyUuid) || isBlank(entityType) || isBlank(entityUuid))
            return false;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty())
            return false;
        Long sid = storyOpt.get().getId();
        return deleteByType(sid, entityType, entityUuid);
    }

    @Override
    public Map<String, Object> getStory(String storyUuid) {
        if (isBlank(storyUuid))
            return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        return storyOpt.map(this::storyToMap).orElse(null);
    }

    @Override
    public Map<String, Object> updateStory(String storyUuid, Map<String, Object> data) {
        if (isBlank(storyUuid) || data == null || data.isEmpty())
            return null;
        Optional<StoryEntity> storyOpt = readPort.findStoryByUuid(storyUuid);
        if (storyOpt.isEmpty())
            return null;
        StoryEntity s = storyOpt.get();
        applyStoryFields(s, data);
        return storyToMap(persistencePort.saveStory(s));
    }

    @Override
    public Map<String, Object> createStory(Map<String, Object> data) {
        if (data == null || data.isEmpty())
            return null;
        StoryEntity s = new StoryEntity();
        applyStoryFields(s, data);
        return storyToMap(persistencePort.saveStory(s));
    }

    // === Dispatch: list ===
    private List<Map<String, Object>> listByType(Long sid, String type) {
        switch (type) {
            case "difficulties":
                return toMaps(readPort.findDifficultiesByStoryId(sid));
            case "locations":
                return toMaps(readPort.findLocationsByStoryId(sid));
            case "location-neighbors":
                return toMaps(readPort.findLocationNeighborsByStoryId(sid));
            case "keys":
                return toMaps(readPort.findKeysByStoryId(sid));
            case "events":
                return toMaps(readPort.findEventsByStoryId(sid));
            case "event-effects":
                return toMaps(readPort.findEventEffectsByStoryId(sid));
            case "choices":
                return toMaps(readPort.findChoicesByStoryId(sid));
            case "choice-conditions":
                return toMaps(readPort.findChoiceConditionsByStoryId(sid));
            case "choice-effects":
                return toMaps(readPort.findChoiceEffectsByStoryId(sid));
            case "items":
                return toMaps(readPort.findItemsByStoryId(sid));
            case "item-effects":
                return toMaps(readPort.findItemEffectsByStoryId(sid));
            case "weather-rules":
                return toMaps(readPort.findWeatherRulesByStoryId(sid));
            case "global-random-events":
                return toMaps(readPort.findGlobalRandomEventsByStoryId(sid));
            case "character-templates":
                return toMaps(readPort.findCharacterTemplatesByStoryId(sid));
            case "classes":
                return toMaps(readPort.findClassesByStoryId(sid));
            case "class-bonuses":
                return toMaps(readPort.findClassBonusesByStoryId(sid));
            case "traits":
                return toMaps(readPort.findTraitsByStoryId(sid));
            case "creators":
                return toMaps(readPort.findCreatorsByStoryId(sid));
            case "cards":
                return toMaps(readPort.findCardsByStoryId(sid));
            case "texts":
                return toMaps(readPort.findTextsByStoryId(sid));
            case "missions":
                return toMaps(readPort.findMissionsByStoryId(sid));
            case "mission-steps":
                return toMaps(readPort.findMissionStepsByStoryId(sid));
            default:
                return List.of();
        }
    }

    // === Dispatch: get ===
    private Map<String, Object> getByType(Long sid, String type, String uuid) {
        switch (type) {
            case "difficulties":
                return optMap(readPort.findDifficultyByStoryIdAndUuid(sid, uuid));
            case "locations":
                return optMap(readPort.findLocationByStoryIdAndUuid(sid, uuid));
            case "location-neighbors":
                return optMap(readPort.findLocationNeighborByStoryIdAndUuid(sid, uuid));
            case "keys":
                return optMap(readPort.findKeyByStoryIdAndUuid(sid, uuid));
            case "events":
                return optMap(readPort.findEventByStoryIdAndUuid(sid, uuid));
            case "event-effects":
                return optMap(readPort.findEventEffectByStoryIdAndUuid(sid, uuid));
            case "choices":
                return optMap(readPort.findChoiceByStoryIdAndUuid(sid, uuid));
            case "choice-conditions":
                return optMap(readPort.findChoiceConditionByStoryIdAndUuid(sid, uuid));
            case "choice-effects":
                return optMap(readPort.findChoiceEffectByStoryIdAndUuid(sid, uuid));
            case "items":
                return optMap(readPort.findItemByStoryIdAndUuid(sid, uuid));
            case "item-effects":
                return optMap(readPort.findItemEffectByStoryIdAndUuid(sid, uuid));
            case "weather-rules":
                return optMap(readPort.findWeatherRuleByStoryIdAndUuid(sid, uuid));
            case "global-random-events":
                return optMap(readPort.findGlobalRandomEventByStoryIdAndUuid(sid, uuid));
            case "character-templates":
                return optMap(readPort.findCharacterTemplateByStoryIdAndUuid(sid, uuid));
            case "classes":
                return optMap(readPort.findClassByStoryIdAndUuid(sid, uuid));
            case "class-bonuses":
                return optMap(readPort.findClassBonusByStoryIdAndUuid(sid, uuid));
            case "traits":
                return optMap(readPort.findTraitByStoryIdAndUuid(sid, uuid));
            case "creators":
                return optMap(readPort.findCreatorByStoryIdAndUuid(sid, uuid));
            case "cards":
                return optMap(readPort.findCardByStoryIdAndUuid(sid, uuid));
            case "texts":
                return optMap(readPort.findTextByStoryIdAndUuid(sid, uuid));
            case "missions":
                return optMap(readPort.findMissionByStoryIdAndUuid(sid, uuid));
            case "mission-steps":
                return optMap(readPort.findMissionStepByStoryIdAndUuid(sid, uuid));
            default:
                return null;
        }
    }

    // === Dispatch: create ===
    private Map<String, Object> createByType(Long sid, String type, Map<String, Object> d) {
        switch (type) {
            case "difficulties":
                return createDifficulty(sid, d);
            case "locations":
                return createLocation(sid, d);
            case "location-neighbors":
                return createLocationNeighbor(sid, d);
            case "keys":
                return createKey(sid, d);
            case "events":
                return createEvent(sid, d);
            case "event-effects":
                return createEventEffect(sid, d);
            case "choices":
                return createChoice(sid, d);
            case "choice-conditions":
                return createChoiceCondition(sid, d);
            case "choice-effects":
                return createChoiceEffect(sid, d);
            case "items":
                return createItem(sid, d);
            case "item-effects":
                return createItemEffect(sid, d);
            case "weather-rules":
                return createWeatherRule(sid, d);
            case "global-random-events":
                return createGlobalRandomEvent(sid, d);
            case "character-templates":
                return createCharacterTemplate(sid, d);
            case "classes":
                return createClass(sid, d);
            case "class-bonuses":
                return createClassBonus(sid, d);
            case "traits":
                return createTrait(sid, d);
            case "texts":
                return createText(sid, d);
            case "cards":
                return createCard(sid, d);
            case "creators":
                return createCreator(sid, d);
            case "missions":
                return createMission(sid, d);
            case "mission-steps":
                return createMissionStep(sid, d);
            default:
                return null;
        }
    }

    // === Dispatch: update ===
    private Map<String, Object> updateByType(Long sid, String type, String uuid, Map<String, Object> d) {
        switch (type) {
            case "difficulties":
                return updateDifficulty(sid, uuid, d);
            case "locations":
                return updateLocation(sid, uuid, d);
            case "location-neighbors":
                return updateLocationNeighbor(sid, uuid, d);
            case "keys":
                return updateKey(sid, uuid, d);
            case "events":
                return updateEvent(sid, uuid, d);
            case "event-effects":
                return updateEventEffect(sid, uuid, d);
            case "choices":
                return updateChoice(sid, uuid, d);
            case "choice-conditions":
                return updateChoiceCondition(sid, uuid, d);
            case "choice-effects":
                return updateChoiceEffect(sid, uuid, d);
            case "items":
                return updateItem(sid, uuid, d);
            case "item-effects":
                return updateItemEffect(sid, uuid, d);
            case "weather-rules":
                return updateWeatherRule(sid, uuid, d);
            case "global-random-events":
                return updateGlobalRandomEvent(sid, uuid, d);
            case "character-templates":
                return updateCharacterTemplate(sid, uuid, d);
            case "classes":
                return updateClass(sid, uuid, d);
            case "class-bonuses":
                return updateClassBonus(sid, uuid, d);
            case "traits":
                return updateTrait(sid, uuid, d);
            case "texts":
                return updateText(sid, uuid, d);
            case "cards":
                return updateCard(sid, uuid, d);
            case "creators":
                return updateCreator(sid, uuid, d);
            case "missions":
                return updateMission(sid, uuid, d);
            case "mission-steps":
                return updateMissionStep(sid, uuid, d);
            default:
                return null;
        }
    }

    // === Dispatch: delete ===
    private boolean deleteByType(Long sid, String type, String uuid) {
        switch (type) {
            case "difficulties":
                return delIf(readPort.findDifficultyByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteDifficultyByUuid(uuid));
            case "locations":
                return delIf(readPort.findLocationByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteLocationByUuid(uuid));
            case "location-neighbors":
                return delIf(readPort.findLocationNeighborByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteLocationNeighborByUuid(uuid));
            case "keys":
                return delIf(readPort.findKeyByStoryIdAndUuid(sid, uuid), () -> persistencePort.deleteKeyByUuid(uuid));
            case "events":
                return delIf(readPort.findEventByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteEventByUuid(uuid));
            case "event-effects":
                return delIf(readPort.findEventEffectByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteEventEffectByUuid(uuid));
            case "choices":
                return delIf(readPort.findChoiceByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteChoiceByUuid(uuid));
            case "choice-conditions":
                return delIf(readPort.findChoiceConditionByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteChoiceConditionByUuid(uuid));
            case "choice-effects":
                return delIf(readPort.findChoiceEffectByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteChoiceEffectByUuid(uuid));
            case "items":
                return delIf(readPort.findItemByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteItemByUuid(uuid));
            case "item-effects":
                return delIf(readPort.findItemEffectByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteItemEffectByUuid(uuid));
            case "weather-rules":
                return delIf(readPort.findWeatherRuleByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteWeatherRuleByUuid(uuid));
            case "global-random-events":
                return delIf(readPort.findGlobalRandomEventByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteGlobalRandomEventByUuid(uuid));
            case "character-templates":
                return delIf(readPort.findCharacterTemplateByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteCharacterTemplateByUuid(uuid));
            case "classes":
                return delIf(readPort.findClassByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteClassByUuid(uuid));
            case "class-bonuses":
                return delIf(readPort.findClassBonusByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteClassBonusByUuid(uuid));
            case "traits":
                return delIf(readPort.findTraitByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteTraitByUuid(uuid));
            case "texts":
                return delIf(readPort.findTextByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteTextByUuid(uuid));
            case "cards":
                return delIf(readPort.findCardByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteCardByUuid(uuid));
            case "creators":
                return delIf(readPort.findCreatorByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteCreatorByUuid(uuid));
            case "missions":
                return delIf(readPort.findMissionByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteMissionByUuid(uuid));
            case "mission-steps":
                return delIf(readPort.findMissionStepByStoryIdAndUuid(sid, uuid),
                        () -> persistencePort.deleteMissionStepByUuid(uuid));
            default:
                return false;
        }
    }

    private boolean delIf(Optional<?> opt, Runnable action) {
        if (opt.isEmpty())
            return false;
        action.run();
        return true;
    }

    // === Create helpers ===
    private Map<String, Object> createLocation(Long sid, Map<String, Object> d) {
        LocationEntity e = new LocationEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyLocationFields(e, d);
        return toMap(persistencePort.saveLocation(e));
    }

    private Map<String, Object> createEvent(Long sid, Map<String, Object> d) {
        EventEntity e = new EventEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyEventFields(e, d);
        return toMap(persistencePort.saveEvent(e));
    }

    private Map<String, Object> createItem(Long sid, Map<String, Object> d) {
        ItemEntity e = new ItemEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyItemFields(e, d);
        return toMap(persistencePort.saveItem(e));
    }

    private Map<String, Object> createDifficulty(Long sid, Map<String, Object> d) {
        StoryDifficultyEntity e = new StoryDifficultyEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyDifficultyFields(e, d);
        return toMap(persistencePort.saveDifficulty(e));
    }

    private Map<String, Object> createCharacterTemplate(Long sid, Map<String, Object> d) {
        CharacterTemplateEntity e = new CharacterTemplateEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyCharacterTemplateFields(e, d);
        return toMap(persistencePort.saveCharacterTemplate(e));
    }

    private Map<String, Object> createClass(Long sid, Map<String, Object> d) {
        ClassEntity e = new ClassEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyClassFields(e, d);
        return toMap(persistencePort.saveClass(e));
    }

    private Map<String, Object> createTrait(Long sid, Map<String, Object> d) {
        TraitEntity e = new TraitEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyTraitFields(e, d);
        return toMap(persistencePort.saveTrait(e));
    }

    private Map<String, Object> createText(Long sid, Map<String, Object> d) {
        TextEntity e = new TextEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyTextFields(e, d);
        return toMap(persistencePort.saveText(e));
    }

    private Map<String, Object> createCard(Long sid, Map<String, Object> d) {
        CardEntity e = new CardEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyCardFields(e, d);
        return toMap(persistencePort.saveCard(e));
    }

    private Map<String, Object> createCreator(Long sid, Map<String, Object> d) {
        CreatorEntity e = new CreatorEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyCreatorFields(e, d);
        return toMap(persistencePort.saveCreator(e));
    }

    private Map<String, Object> createLocationNeighbor(Long sid, Map<String, Object> d) {
        LocationNeighborEntity e = new LocationNeighborEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyLocationNeighborFields(e, d);
        return toMap(persistencePort.saveLocationNeighbor(e));
    }

    private Map<String, Object> createKey(Long sid, Map<String, Object> d) {
        KeyEntity e = new KeyEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyKeyFields(e, d);
        return toMap(persistencePort.saveKey(e));
    }

    private Map<String, Object> createEventEffect(Long sid, Map<String, Object> d) {
        EventEffectEntity e = new EventEffectEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyEventEffectFields(e, d);
        return toMap(persistencePort.saveEventEffect(e));
    }

    private Map<String, Object> createChoice(Long sid, Map<String, Object> d) {
        ChoiceEntity e = new ChoiceEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyChoiceFields(e, d);
        return toMap(persistencePort.saveChoice(e));
    }

    private Map<String, Object> createChoiceCondition(Long sid, Map<String, Object> d) {
        ChoiceConditionEntity e = new ChoiceConditionEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyChoiceConditionFields(e, d);
        return toMap(persistencePort.saveChoiceCondition(e));
    }

    private Map<String, Object> createChoiceEffect(Long sid, Map<String, Object> d) {
        ChoiceEffectEntity e = new ChoiceEffectEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyChoiceEffectFields(e, d);
        return toMap(persistencePort.saveChoiceEffect(e));
    }

    private Map<String, Object> createItemEffect(Long sid, Map<String, Object> d) {
        ItemEffectEntity e = new ItemEffectEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyItemEffectFields(e, d);
        return toMap(persistencePort.saveItemEffect(e));
    }

    private Map<String, Object> createWeatherRule(Long sid, Map<String, Object> d) {
        WeatherRuleEntity e = new WeatherRuleEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyWeatherRuleFields(e, d);
        return toMap(persistencePort.saveWeatherRule(e));
    }

    private Map<String, Object> createGlobalRandomEvent(Long sid, Map<String, Object> d) {
        GlobalRandomEventEntity e = new GlobalRandomEventEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyGlobalRandomEventFields(e, d);
        return toMap(persistencePort.saveGlobalRandomEvent(e));
    }

    private Map<String, Object> createClassBonus(Long sid, Map<String, Object> d) {
        ClassBonusEntity e = new ClassBonusEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyClassBonusFields(e, d);
        return toMap(persistencePort.saveClassBonus(e));
    }

    private Map<String, Object> createMission(Long sid, Map<String, Object> d) {
        MissionEntity e = new MissionEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyMissionFields(e, d);
        return toMap(persistencePort.saveMission(e));
    }

    private Map<String, Object> createMissionStep(Long sid, Map<String, Object> d) {
        MissionStepEntity e = new MissionStepEntity();
        e.setIdStory(sid);
        applyBaseFields(e, d);
        applyMissionFields(e, d);
        applyMissionStepFields(e, d);
        return toMap(persistencePort.saveMissionStep(e));
    }

    // === Update helpers (find + apply + save) ===
    private Map<String, Object> updateLocation(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findLocationByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyLocationFields(e, d);
            return toMap(persistencePort.saveLocation(e));
        }).orElse(null);
    }

    private Map<String, Object> updateEvent(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findEventByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyEventFields(e, d);
            return toMap(persistencePort.saveEvent(e));
        }).orElse(null);
    }

    private Map<String, Object> updateItem(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findItemByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyItemFields(e, d);
            return toMap(persistencePort.saveItem(e));
        }).orElse(null);
    }

    private Map<String, Object> updateDifficulty(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findDifficultyByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyDifficultyFields(e, d);
            return toMap(persistencePort.saveDifficulty(e));
        }).orElse(null);
    }

    private Map<String, Object> updateCharacterTemplate(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findCharacterTemplateByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyCharacterTemplateFields(e, d);
            return toMap(persistencePort.saveCharacterTemplate(e));
        }).orElse(null);
    }

    private Map<String, Object> updateClass(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findClassByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyClassFields(e, d);
            return toMap(persistencePort.saveClass(e));
        }).orElse(null);
    }

    private Map<String, Object> updateTrait(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findTraitByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyTraitFields(e, d);
            return toMap(persistencePort.saveTrait(e));
        }).orElse(null);
    }

    private Map<String, Object> updateText(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findTextByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyTextFields(e, d);
            return toMap(persistencePort.saveText(e));
        }).orElse(null);
    }

    private Map<String, Object> updateCard(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findCardByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyCardFields(e, d);
            return toMap(persistencePort.saveCard(e));
        }).orElse(null);
    }

    private Map<String, Object> updateCreator(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findCreatorByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyCreatorFields(e, d);
            return toMap(persistencePort.saveCreator(e));
        }).orElse(null);
    }

    private Map<String, Object> updateLocationNeighbor(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findLocationNeighborByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyLocationNeighborFields(e, d);
            return toMap(persistencePort.saveLocationNeighbor(e));
        }).orElse(null);
    }

    private Map<String, Object> updateKey(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findKeyByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyKeyFields(e, d);
            return toMap(persistencePort.saveKey(e));
        }).orElse(null);
    }

    private Map<String, Object> updateEventEffect(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findEventEffectByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyEventEffectFields(e, d);
            return toMap(persistencePort.saveEventEffect(e));
        }).orElse(null);
    }

    private Map<String, Object> updateChoice(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findChoiceByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyChoiceFields(e, d);
            return toMap(persistencePort.saveChoice(e));
        }).orElse(null);
    }

    private Map<String, Object> updateChoiceCondition(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findChoiceConditionByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyChoiceConditionFields(e, d);
            return toMap(persistencePort.saveChoiceCondition(e));
        }).orElse(null);
    }

    private Map<String, Object> updateChoiceEffect(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findChoiceEffectByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyChoiceEffectFields(e, d);
            return toMap(persistencePort.saveChoiceEffect(e));
        }).orElse(null);
    }

    private Map<String, Object> updateItemEffect(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findItemEffectByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyItemEffectFields(e, d);
            return toMap(persistencePort.saveItemEffect(e));
        }).orElse(null);
    }

    private Map<String, Object> updateWeatherRule(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findWeatherRuleByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyWeatherRuleFields(e, d);
            return toMap(persistencePort.saveWeatherRule(e));
        }).orElse(null);
    }

    private Map<String, Object> updateGlobalRandomEvent(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findGlobalRandomEventByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyGlobalRandomEventFields(e, d);
            return toMap(persistencePort.saveGlobalRandomEvent(e));
        }).orElse(null);
    }

    private Map<String, Object> updateClassBonus(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findClassBonusByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyClassBonusFields(e, d);
            return toMap(persistencePort.saveClassBonus(e));
        }).orElse(null);
    }

    private Map<String, Object> updateMission(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findMissionByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyMissionFields(e, d);
            return toMap(persistencePort.saveMission(e));
        }).orElse(null);
    }

    private Map<String, Object> updateMissionStep(Long sid, String uuid, Map<String, Object> d) {
        return readPort.findMissionStepByStoryIdAndUuid(sid, uuid).map(e -> {
            applyBaseFields(e, d);
            applyMissionFields(e, d);
            applyMissionStepFields(e, d);
            return toMap(persistencePort.saveMissionStep(e));
        }).orElse(null);
    }

    // === Mapping ===
    private Map<String, Object> toMap(BaseStoryEntity e) {
        Map<String, Object> m = new LinkedHashMap<>();
        try {
            m.put("id", e.getClass().getMethod("getId").invoke(e));
        } catch (Exception ignored) {
        }
        m.put("uuid", e.getUuid());
        m.put("idStory", e.getIdStory());
        m.put("idCard", e.getIdCard());
        m.put("idTextName", e.getIdTextName());
        m.put("idTextDescription", e.getIdTextDescription());
        m.put("tsInsert", e.getTsInsert());
        m.put("tsUpdate", e.getTsUpdate());
        // Entity-specific fields
        if (e instanceof TextEntity) {
            TextEntity t = (TextEntity) e;
            m.put("idText", t.getIdText());
            m.put("lang", t.getLang());
            m.put("shortText", t.getShortText());
            m.put("longText", t.getLongText());
            m.put("idTextCopyright", t.getIdTextCopyright());
            m.put("linkCopyright", t.getLinkCopyright());
            m.put("idCreator", t.getIdCreator());
        } else if (e instanceof LocationNeighborEntity) {
            LocationNeighborEntity ln = (LocationNeighborEntity) e;
            m.put("idLocationFrom", ln.getIdLocationFrom());
            m.put("idLocationTo", ln.getIdLocationTo());
            m.put("direction", ln.getDirection());
            m.put("flagBack", ln.getFlagBack());
            m.put("conditionRegistryKey", ln.getConditionRegistryKey());
            m.put("conditionRegistryValue", ln.getConditionRegistryValue());
            m.put("energyCost", ln.getEnergyCost());
            m.put("idTextGo", ln.getIdTextGo());
            m.put("idTextBack", ln.getIdTextBack());
        } else if (e instanceof LocationEntity) {
            LocationEntity l = (LocationEntity) e;
            m.put("idTextNarrative", l.getIdTextNarrative());
            m.put("idImage", l.getIdImage());
            m.put("isSafe", l.getIsSafe());
            m.put("costEnergyEnter", l.getCostEnergyEnter());
            m.put("counterTime", l.getCounterTime());
            m.put("idEventIfCounterZero", l.getIdEventIfCounterZero());
            m.put("secureParam", l.getSecureParam());
            m.put("idEventIfCharacterStartTime", l.getIdEventIfCharacterStartTime());
            m.put("idEventIfCharacterEnterFirstTime", l.getIdEventIfCharacterEnterFirstTime());
            m.put("idEventIfFirstTime", l.getIdEventIfFirstTime());
            m.put("idEventNotFirstTime", l.getIdEventNotFirstTime());
            m.put("priorityAutomaticEvent", l.getPriorityAutomaticEvent());
            m.put("idAudio", l.getIdAudio());
            m.put("maxCharacters", l.getMaxCharacters());
        } else if (e instanceof KeyEntity) {
            KeyEntity k = (KeyEntity) e;
            m.put("name", k.getName());
            m.put("value", k.getValue());
            m.put("group", k.getGroup());
            m.put("priority", k.getPriority());
            m.put("visibility", k.getVisibility());
        } else if (e instanceof EventEffectEntity) {
            EventEffectEntity ee = (EventEffectEntity) e;
            m.put("idEvent", ee.getIdEvent());
            m.put("statistics", ee.getStatistics());
            m.put("value", ee.getValue());
            m.put("target", ee.getTarget());
            m.put("traitsToAdd", ee.getTraitsToAdd());
            m.put("traitsToRemove", ee.getTraitsToRemove());
            m.put("targetClass", ee.getTargetClass());
            m.put("idItemTarget", ee.getIdItemTarget());
            m.put("itemAction", ee.getItemAction());
        } else if (e instanceof EventEntity) {
            EventEntity ev = (EventEntity) e;
            m.put("idSpecificLocation", ev.getIdSpecificLocation());
            m.put("type", ev.getType());
            m.put("costEnery", ev.getCostEnery());
            m.put("flagEndTime", ev.getFlagEndTime());
            m.put("characteristicToAdd", ev.getCharacteristicToAdd());
            m.put("characteristicToRemove", ev.getCharacteristicToRemove());
            m.put("keyToAdd", ev.getKeyToAdd());
            m.put("keyValueToAdd", ev.getKeyValueToAdd());
            m.put("idItemToAdd", ev.getIdItemToAdd());
            m.put("idWeather", ev.getIdWeather());
            m.put("idEventNext", ev.getIdEventNext());
            m.put("coinCost", ev.getCoinCost());
        } else if (e instanceof ChoiceConditionEntity) {
            ChoiceConditionEntity cc = (ChoiceConditionEntity) e;
            m.put("idChoices", cc.getIdChoices());
            m.put("type", cc.getType());
            m.put("key", cc.getKey());
            m.put("value", cc.getValue());
            m.put("operator", cc.getOperator());
        } else if (e instanceof ChoiceEffectEntity) {
            ChoiceEffectEntity ce = (ChoiceEffectEntity) e;
            m.put("idChoices", ce.getIdChoices());
            m.put("idScelta", ce.getIdScelta());
            m.put("flagGroup", ce.getFlagGroup());
            m.put("statistics", ce.getStatistics());
            m.put("value", ce.getValue());
            m.put("idText", ce.getIdText());
            m.put("key", ce.getKey());
            m.put("valueToAdd", ce.getValueToAdd());
            m.put("valueToRemove", ce.getValueToRemove());
        } else if (e instanceof ChoiceEntity) {
            ChoiceEntity ch = (ChoiceEntity) e;
            m.put("idEvent", ch.getIdEvent());
            m.put("idLocation", ch.getIdLocation());
            m.put("priority", ch.getPriority());
            m.put("idTextNarrative", ch.getIdTextNarrative());
            m.put("idEventTorun", ch.getIdEventTorun());
            m.put("limitSad", ch.getLimitSad());
            m.put("limitDex", ch.getLimitDex());
            m.put("limitInt", ch.getLimitInt());
            m.put("limitCos", ch.getLimitCos());
            m.put("otherwiseFlag", ch.getOtherwiseFlag());
            m.put("isProgress", ch.getIsProgress());
            m.put("logicOperator", ch.getLogicOperator());
        } else if (e instanceof ItemEffectEntity) {
            ItemEffectEntity ie = (ItemEffectEntity) e;
            m.put("idItem", ie.getIdItem());
            m.put("effectCode", ie.getEffectCode());
            m.put("effectValue", ie.getEffectValue());
        } else if (e instanceof ItemEntity) {
            ItemEntity i = (ItemEntity) e;
            m.put("weight", i.getWeight());
            m.put("isConsumabile", i.getIsConsumabile());
            m.put("idClassPermitted", i.getIdClassPermitted());
            m.put("idClassProhibited", i.getIdClassProhibited());
        } else if (e instanceof WeatherRuleEntity) {
            WeatherRuleEntity wr = (WeatherRuleEntity) e;
            m.put("probability", wr.getProbability());
            m.put("costMoveSafeLocation", wr.getCostMoveSafeLocation());
            m.put("costMoveNotSafeLocation", wr.getCostMoveNotSafeLocation());
            m.put("conditionKey", wr.getConditionKey());
            m.put("conditionKeyValue", wr.getConditionKeyValue());
            m.put("timeFrom", wr.getTimeFrom());
            m.put("timeTo", wr.getTimeTo());
            m.put("idText", wr.getIdText());
            m.put("active", wr.getActive());
            m.put("priority", wr.getPriority());
            m.put("deltaEnergy", wr.getDeltaEnergy());
            m.put("idEvent", wr.getIdEvent());
        } else if (e instanceof GlobalRandomEventEntity) {
            GlobalRandomEventEntity gr = (GlobalRandomEventEntity) e;
            m.put("conditionKey", gr.getConditionKey());
            m.put("conditionValue", gr.getConditionValue());
            m.put("probability", gr.getProbability());
            m.put("idText", gr.getIdText());
            m.put("idEvent", gr.getIdEvent());
        } else if (e instanceof StoryDifficultyEntity) {
            StoryDifficultyEntity d = (StoryDifficultyEntity) e;
            m.put("expCost", d.getExpCost());
            m.put("maxWeight", d.getMaxWeight());
            m.put("minCharacter", d.getMinCharacter());
            m.put("maxCharacter", d.getMaxCharacter());
            m.put("costHelpComa", d.getCostHelpComa());
            m.put("costMaxCharacteristics", d.getCostMaxCharacteristics());
            m.put("numberMaxFreeAction", d.getNumberMaxFreeAction());
        } else if (e instanceof CharacterTemplateEntity) {
            CharacterTemplateEntity ct = (CharacterTemplateEntity) e;
            m.put("lifeMax", ct.getLifeMax());
            m.put("energyMax", ct.getEnergyMax());
            m.put("sadMax", ct.getSadMax());
            m.put("dexterityStart", ct.getDexterityStart());
            m.put("intelligenceStart", ct.getIntelligenceStart());
            m.put("constitutionStart", ct.getConstitutionStart());
        } else if (e instanceof ClassBonusEntity) {
            ClassBonusEntity cb = (ClassBonusEntity) e;
            m.put("idClass", cb.getIdClass());
            m.put("statistic", cb.getStatistic());
            m.put("value", cb.getValue());
        } else if (e instanceof ClassEntity) {
            ClassEntity c = (ClassEntity) e;
            m.put("weightMax", c.getWeightMax());
            m.put("dexterityBase", c.getDexterityBase());
            m.put("intelligenceBase", c.getIntelligenceBase());
            m.put("constitutionBase", c.getConstitutionBase());
        } else if (e instanceof TraitEntity) {
            TraitEntity tr = (TraitEntity) e;
            m.put("idClassPermitted", tr.getIdClassPermitted());
            m.put("idClassProhibited", tr.getIdClassProhibited());
            m.put("costPositive", tr.getCostPositive());
            m.put("costNegative", tr.getCostNegative());
        } else if (e instanceof CardEntity) {
            CardEntity cd = (CardEntity) e;
            m.put("idTextTitle", cd.getIdTextTitle());
            m.put("idTextCopyright", cd.getIdTextCopyright());
            m.put("linkCopyright", cd.getLinkCopyright());
            m.put("idCreator", cd.getIdCreator());
            m.put("urlImmage", cd.getUrlImmage());
            m.put("alternativeImage", cd.getAlternativeImage());
            m.put("awesomeIcon", cd.getAwesomeIcon());
            m.put("styleMain", cd.getStyleMain());
            m.put("styleDetail", cd.getStyleDetail());
        } else if (e instanceof CreatorEntity) {
            CreatorEntity cr = (CreatorEntity) e;
            m.put("idText", cr.getIdText());
            m.put("link", cr.getLink());
            m.put("url", cr.getUrl());
            m.put("urlImage", cr.getUrlImage());
            m.put("urlEmote", cr.getUrlEmote());
            m.put("urlInstagram", cr.getUrlInstagram());
        } else if (e instanceof MissionStepEntity) {
            MissionStepEntity ms = (MissionStepEntity) e;
            putMissionFields(m, ms);
            m.put("idMission", ms.getIdMission());
            m.put("step", ms.getStep());
        } else if (e instanceof MissionEntity) {
            putMissionFields(m, (MissionEntity) e);
        }
        return m;
    }

    private void putMissionFields(Map<String, Object> m, BaseMissionEntity e) {
        m.put("conditionKey", e.getConditionKey());
        m.put("conditionValueFrom", e.getConditionValueFrom());
        m.put("conditionValueTo", e.getConditionValueTo());
        m.put("idEventCompleted", e.getIdEventCompleted());
    }

    private Map<String, Object> optMap(Optional<? extends BaseStoryEntity> opt) {
        return opt.map(this::toMap).orElse(null);
    }

    private List<Map<String, Object>> toMaps(List<? extends BaseStoryEntity> list) {
        if (list == null)
            return List.of();
        return list.stream().map(this::toMap).collect(Collectors.toList());
    }

    private Map<String, Object> storyToMap(StoryEntity s) {
        Map<String, Object> m = toMap(s);
        m.put("id", s.getId());
        m.put("author", s.getAuthor());
        m.put("versionMin", s.getVersionMin());
        m.put("versionMax", s.getVersionMax());
        m.put("category", s.getCategory());
        m.put("group", s.getGroup());
        m.put("visibility", s.getVisibility());
        m.put("priority", s.getPriority());
        m.put("peghi", s.getPeghi());
        m.put("idTextTitle", s.getIdTextTitle());
        m.put("idLocationStart", s.getIdLocationStart());
        m.put("idImage", s.getIdImage());
        m.put("idLocationAllPlayerComa", s.getIdLocationAllPlayerComa());
        m.put("idEventAllPlayerComa", s.getIdEventAllPlayerComa());
        m.put("clockSingularDescription", s.getClockSingularDescription());
        m.put("clockPluralDescription", s.getClockPluralDescription());
        m.put("idEventEndGame", s.getIdEventEndGame());
        m.put("idTextCopyright", s.getIdTextCopyright());
        m.put("linkCopyright", s.getLinkCopyright());
        m.put("idCreator", s.getIdCreator());
        return m;
    }

    private void applyBaseFields(BaseStoryEntity e, Map<String, Object> d) {
        if (d.containsKey("idTextName"))
            e.setIdTextName(intVal(d, "idTextName"));
        if (d.containsKey("idTextDescription"))
            e.setIdTextDescription(intVal(d, "idTextDescription"));
        if (d.containsKey("idCard"))
            e.setIdCard(intVal(d, "idCard"));
    }

    private void applyStoryFields(StoryEntity s, Map<String, Object> d) {
        applyBaseFields(s, d);
        if (d.containsKey("author"))
            s.setAuthor(str(d, "author"));
        if (d.containsKey("versionMin"))
            s.setVersionMin(str(d, "versionMin"));
        if (d.containsKey("versionMax"))
            s.setVersionMax(str(d, "versionMax"));
        if (d.containsKey("category"))
            s.setCategory(str(d, "category"));
        if (d.containsKey("group"))
            s.setGroup(str(d, "group"));
        if (d.containsKey("visibility"))
            s.setVisibility(str(d, "visibility"));
        if (d.containsKey("priority"))
            s.setPriority(intVal(d, "priority"));
        if (d.containsKey("peghi"))
            s.setPeghi(intVal(d, "peghi"));
        if (d.containsKey("idTextTitle"))
            s.setIdTextTitle(intVal(d, "idTextTitle"));
        if (d.containsKey("idLocationStart"))
            s.setIdLocationStart(intVal(d, "idLocationStart"));
        if (d.containsKey("idImage"))
            s.setIdImage(intVal(d, "idImage"));
        if (d.containsKey("idLocationAllPlayerComa"))
            s.setIdLocationAllPlayerComa(intVal(d, "idLocationAllPlayerComa"));
        if (d.containsKey("idEventAllPlayerComa"))
            s.setIdEventAllPlayerComa(intVal(d, "idEventAllPlayerComa"));
        if (d.containsKey("clockSingularDescription"))
            s.setClockSingularDescription(str(d, "clockSingularDescription"));
        if (d.containsKey("clockPluralDescription"))
            s.setClockPluralDescription(str(d, "clockPluralDescription"));
        if (d.containsKey("idEventEndGame"))
            s.setIdEventEndGame(intVal(d, "idEventEndGame"));
        if (d.containsKey("idTextCopyright"))
            s.setIdTextCopyright(intVal(d, "idTextCopyright"));
        if (d.containsKey("linkCopyright"))
            s.setLinkCopyright(str(d, "linkCopyright"));
        if (d.containsKey("idCreator"))
            s.setIdCreator(intVal(d, "idCreator"));
    }

    private void applyMissionFields(BaseMissionEntity e, Map<String, Object> d) {
        if (d.containsKey("conditionKey"))
            e.setConditionKey(str(d, "conditionKey"));
        if (d.containsKey("conditionValueFrom"))
            e.setConditionValueFrom(str(d, "conditionValueFrom"));
        if (d.containsKey("conditionValueTo"))
            e.setConditionValueTo(str(d, "conditionValueTo"));
        if (d.containsKey("idEventCompleted"))
            e.setIdEventCompleted(intVal(d, "idEventCompleted"));
    }

    // === Utilities ===
    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private String str(Map<String, Object> d, String k) {
        Object v = d.get(k);
        return v != null ? v.toString() : null;
    }

    private Integer intVal(Map<String, Object> d, String k) {
        Object v = d.get(k);
        if (v instanceof Number)
            return ((Number) v).intValue();
        if (v instanceof String) {
            try {
                return Integer.parseInt((String) v);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private void applyLocationFields(LocationEntity e, Map<String, Object> d) {
        if (d.containsKey("idTextNarrative"))
            e.setIdTextNarrative(intVal(d, "idTextNarrative"));
        if (d.containsKey("idImage"))
            e.setIdImage(intVal(d, "idImage"));
        if (d.containsKey("isSafe"))
            e.setIsSafe(intVal(d, "isSafe"));
        if (d.containsKey("costEnergyEnter"))
            e.setCostEnergyEnter(intVal(d, "costEnergyEnter"));
        if (d.containsKey("counterTime"))
            e.setCounterTime(intVal(d, "counterTime"));
        if (d.containsKey("idEventIfCounterZero"))
            e.setIdEventIfCounterZero(intVal(d, "idEventIfCounterZero"));
        if (d.containsKey("secureParam"))
            e.setSecureParam(intVal(d, "secureParam"));
        if (d.containsKey("idEventIfCharacterStartTime"))
            e.setIdEventIfCharacterStartTime(intVal(d, "idEventIfCharacterStartTime"));
        if (d.containsKey("idEventIfCharacterEnterFirstTime"))
            e.setIdEventIfCharacterEnterFirstTime(intVal(d, "idEventIfCharacterEnterFirstTime"));
        if (d.containsKey("idEventIfFirstTime"))
            e.setIdEventIfFirstTime(intVal(d, "idEventIfFirstTime"));
        if (d.containsKey("idEventNotFirstTime"))
            e.setIdEventNotFirstTime(intVal(d, "idEventNotFirstTime"));
        if (d.containsKey("priorityAutomaticEvent"))
            e.setPriorityAutomaticEvent(intVal(d, "priorityAutomaticEvent"));
        if (d.containsKey("idAudio"))
            e.setIdAudio(intVal(d, "idAudio"));
        if (d.containsKey("maxCharacters"))
            e.setMaxCharacters(intVal(d, "maxCharacters"));
    }

    private void applyEventFields(EventEntity e, Map<String, Object> d) {
        if (d.containsKey("idSpecificLocation"))
            e.setIdSpecificLocation(intVal(d, "idSpecificLocation"));
        if (d.containsKey("type"))
            e.setType(str(d, "type"));
        if (d.containsKey("costEnery"))
            e.setCostEnery(intVal(d, "costEnery"));
        if (d.containsKey("flagEndTime"))
            e.setFlagEndTime(intVal(d, "flagEndTime"));
        if (d.containsKey("characteristicToAdd"))
            e.setCharacteristicToAdd(str(d, "characteristicToAdd"));
        if (d.containsKey("characteristicToRemove"))
            e.setCharacteristicToRemove(str(d, "characteristicToRemove"));
        if (d.containsKey("keyToAdd"))
            e.setKeyToAdd(str(d, "keyToAdd"));
        if (d.containsKey("keyValueToAdd"))
            e.setKeyValueToAdd(str(d, "keyValueToAdd"));
        if (d.containsKey("idItemToAdd"))
            e.setIdItemToAdd(intVal(d, "idItemToAdd"));
        if (d.containsKey("idWeather"))
            e.setIdWeather(intVal(d, "idWeather"));
        if (d.containsKey("idEventNext"))
            e.setIdEventNext(intVal(d, "idEventNext"));
        if (d.containsKey("coinCost"))
            e.setCoinCost(intVal(d, "coinCost"));
    }

    private void applyItemFields(ItemEntity e, Map<String, Object> d) {
        if (d.containsKey("weight"))
            e.setWeight(intVal(d, "weight"));
        if (d.containsKey("isConsumabile"))
            e.setIsConsumabile(intVal(d, "isConsumabile"));
        if (d.containsKey("idClassPermitted"))
            e.setIdClassPermitted(intVal(d, "idClassPermitted"));
        if (d.containsKey("idClassProhibited"))
            e.setIdClassProhibited(intVal(d, "idClassProhibited"));
    }

    private void applyDifficultyFields(StoryDifficultyEntity e, Map<String, Object> d) {
        if (d.containsKey("expCost"))
            e.setExpCost(intVal(d, "expCost"));
        if (d.containsKey("maxWeight"))
            e.setMaxWeight(intVal(d, "maxWeight"));
        if (d.containsKey("minCharacter"))
            e.setMinCharacter(intVal(d, "minCharacter"));
        if (d.containsKey("maxCharacter"))
            e.setMaxCharacter(intVal(d, "maxCharacter"));
        if (d.containsKey("costHelpComa"))
            e.setCostHelpComa(intVal(d, "costHelpComa"));
        if (d.containsKey("costMaxCharacteristics"))
            e.setCostMaxCharacteristics(intVal(d, "costMaxCharacteristics"));
        if (d.containsKey("numberMaxFreeAction"))
            e.setNumberMaxFreeAction(intVal(d, "numberMaxFreeAction"));
    }

    private void applyCharacterTemplateFields(CharacterTemplateEntity e, Map<String, Object> d) {
        if (d.containsKey("lifeMax"))
            e.setLifeMax(intVal(d, "lifeMax"));
        if (d.containsKey("energyMax"))
            e.setEnergyMax(intVal(d, "energyMax"));
        if (d.containsKey("sadMax"))
            e.setSadMax(intVal(d, "sadMax"));
        if (d.containsKey("dexterityStart"))
            e.setDexterityStart(intVal(d, "dexterityStart"));
        if (d.containsKey("intelligenceStart"))
            e.setIntelligenceStart(intVal(d, "intelligenceStart"));
        if (d.containsKey("constitutionStart"))
            e.setConstitutionStart(intVal(d, "constitutionStart"));
    }

    private void applyClassFields(ClassEntity e, Map<String, Object> d) {
        if (d.containsKey("weightMax"))
            e.setWeightMax(intVal(d, "weightMax"));
        if (d.containsKey("dexterityBase"))
            e.setDexterityBase(intVal(d, "dexterityBase"));
        if (d.containsKey("intelligenceBase"))
            e.setIntelligenceBase(intVal(d, "intelligenceBase"));
        if (d.containsKey("constitutionBase"))
            e.setConstitutionBase(intVal(d, "constitutionBase"));
    }

    private void applyTraitFields(TraitEntity e, Map<String, Object> d) {
        if (d.containsKey("idClassPermitted"))
            e.setIdClassPermitted(intVal(d, "idClassPermitted"));
        if (d.containsKey("idClassProhibited"))
            e.setIdClassProhibited(intVal(d, "idClassProhibited"));
        if (d.containsKey("costPositive"))
            e.setCostPositive(intVal(d, "costPositive"));
        if (d.containsKey("costNegative"))
            e.setCostNegative(intVal(d, "costNegative"));
    }

    private void applyTextFields(TextEntity e, Map<String, Object> d) {
        if (d.containsKey("idText"))
            e.setIdText(intVal(d, "idText"));
        if (d.containsKey("lang"))
            e.setLang(str(d, "lang"));
        if (d.containsKey("shortText"))
            e.setShortText(str(d, "shortText"));
        if (d.containsKey("longText"))
            e.setLongText(str(d, "longText"));
        if (d.containsKey("idTextCopyright"))
            e.setIdTextCopyright(intVal(d, "idTextCopyright"));
        if (d.containsKey("linkCopyright"))
            e.setLinkCopyright(str(d, "linkCopyright"));
        if (d.containsKey("idCreator"))
            e.setIdCreator(intVal(d, "idCreator"));
    }

    private void applyCardFields(CardEntity e, Map<String, Object> d) {
        if (d.containsKey("idTextTitle"))
            e.setIdTextTitle(intVal(d, "idTextTitle"));
        if (d.containsKey("idTextDescription"))
            e.setIdTextDescription(intVal(d, "idTextDescription"));
        if (d.containsKey("idTextCopyright"))
            e.setIdTextCopyright(intVal(d, "idTextCopyright"));
        if (d.containsKey("linkCopyright"))
            e.setLinkCopyright(str(d, "linkCopyright"));
        if (d.containsKey("idCreator"))
            e.setIdCreator(intVal(d, "idCreator"));
        if (d.containsKey("urlImmage"))
            e.setUrlImmage(str(d, "urlImmage"));
        if (d.containsKey("alternativeImage"))
            e.setAlternativeImage(str(d, "alternativeImage"));
        if (d.containsKey("awesomeIcon"))
            e.setAwesomeIcon(str(d, "awesomeIcon"));
        if (d.containsKey("styleMain"))
            e.setStyleMain(str(d, "styleMain"));
        if (d.containsKey("styleDetail"))
            e.setStyleDetail(str(d, "styleDetail"));
    }

    private void applyCreatorFields(CreatorEntity e, Map<String, Object> d) {
        if (d.containsKey("idText"))
            e.setIdText(intVal(d, "idText"));
        if (d.containsKey("link"))
            e.setLink(str(d, "link"));
        if (d.containsKey("url"))
            e.setUrl(str(d, "url"));
        if (d.containsKey("urlImage"))
            e.setUrlImage(str(d, "urlImage"));
        if (d.containsKey("urlEmote"))
            e.setUrlEmote(str(d, "urlEmote"));
        if (d.containsKey("urlInstagram"))
            e.setUrlInstagram(str(d, "urlInstagram"));
    }

    private void applyLocationNeighborFields(LocationNeighborEntity e, Map<String, Object> d) {
        if (d.containsKey("idLocationFrom"))
            e.setIdLocationFrom(intVal(d, "idLocationFrom"));
        if (d.containsKey("idLocationTo"))
            e.setIdLocationTo(intVal(d, "idLocationTo"));
        if (d.containsKey("direction"))
            e.setDirection(str(d, "direction"));
        if (d.containsKey("flagBack"))
            e.setFlagBack(intVal(d, "flagBack"));
        if (d.containsKey("conditionRegistryKey"))
            e.setConditionRegistryKey(str(d, "conditionRegistryKey"));
        if (d.containsKey("conditionRegistryValue"))
            e.setConditionRegistryValue(str(d, "conditionRegistryValue"));
        if (d.containsKey("energyCost"))
            e.setEnergyCost(intVal(d, "energyCost"));
        if (d.containsKey("idTextGo"))
            e.setIdTextGo(intVal(d, "idTextGo"));
        if (d.containsKey("idTextBack"))
            e.setIdTextBack(intVal(d, "idTextBack"));
    }

    private void applyKeyFields(KeyEntity e, Map<String, Object> d) {
        if (d.containsKey("name"))
            e.setName(str(d, "name"));
        if (d.containsKey("value"))
            e.setValue(str(d, "value"));
        if (d.containsKey("group"))
            e.setGroup(str(d, "group"));
        if (d.containsKey("priority"))
            e.setPriority(intVal(d, "priority"));
        if (d.containsKey("visibility"))
            e.setVisibility(str(d, "visibility"));
    }

    private void applyEventEffectFields(EventEffectEntity e, Map<String, Object> d) {
        if (d.containsKey("idEvent"))
            e.setIdEvent(intVal(d, "idEvent"));
        if (d.containsKey("statistics"))
            e.setStatistics(str(d, "statistics"));
        if (d.containsKey("value"))
            e.setValue(intVal(d, "value"));
        if (d.containsKey("target"))
            e.setTarget(str(d, "target"));
        if (d.containsKey("traitsToAdd"))
            e.setTraitsToAdd(str(d, "traitsToAdd"));
        if (d.containsKey("traitsToRemove"))
            e.setTraitsToRemove(str(d, "traitsToRemove"));
        if (d.containsKey("targetClass"))
            e.setTargetClass(intVal(d, "targetClass"));
        if (d.containsKey("idItemTarget"))
            e.setIdItemTarget(intVal(d, "idItemTarget"));
        if (d.containsKey("itemAction"))
            e.setItemAction(str(d, "itemAction"));
    }

    private void applyChoiceFields(ChoiceEntity e, Map<String, Object> d) {
        if (d.containsKey("idEvent"))
            e.setIdEvent(intVal(d, "idEvent"));
        if (d.containsKey("idLocation"))
            e.setIdLocation(intVal(d, "idLocation"));
        if (d.containsKey("priority"))
            e.setPriority(intVal(d, "priority"));
        if (d.containsKey("idTextNarrative"))
            e.setIdTextNarrative(intVal(d, "idTextNarrative"));
        if (d.containsKey("idEventTorun"))
            e.setIdEventTorun(intVal(d, "idEventTorun"));
        if (d.containsKey("limitSad"))
            e.setLimitSad(intVal(d, "limitSad"));
        if (d.containsKey("limitDex"))
            e.setLimitDex(intVal(d, "limitDex"));
        if (d.containsKey("limitInt"))
            e.setLimitInt(intVal(d, "limitInt"));
        if (d.containsKey("limitCos"))
            e.setLimitCos(intVal(d, "limitCos"));
        if (d.containsKey("otherwiseFlag"))
            e.setOtherwiseFlag(intVal(d, "otherwiseFlag"));
        if (d.containsKey("isProgress"))
            e.setIsProgress(intVal(d, "isProgress"));
        if (d.containsKey("logicOperator"))
            e.setLogicOperator(str(d, "logicOperator"));
    }

    private void applyChoiceConditionFields(ChoiceConditionEntity e, Map<String, Object> d) {
        if (d.containsKey("idChoices"))
            e.setIdChoices(intVal(d, "idChoices"));
        if (d.containsKey("type"))
            e.setType(str(d, "type"));
        if (d.containsKey("key"))
            e.setKey(str(d, "key"));
        if (d.containsKey("value"))
            e.setValue(str(d, "value"));
        if (d.containsKey("operator"))
            e.setOperator(str(d, "operator"));
    }

    private void applyChoiceEffectFields(ChoiceEffectEntity e, Map<String, Object> d) {
        if (d.containsKey("idChoices"))
            e.setIdChoices(intVal(d, "idChoices"));
        if (d.containsKey("idScelta"))
            e.setIdScelta(intVal(d, "idScelta"));
        if (d.containsKey("flagGroup"))
            e.setFlagGroup(intVal(d, "flagGroup"));
        if (d.containsKey("statistics"))
            e.setStatistics(str(d, "statistics"));
        if (d.containsKey("value"))
            e.setValue(intVal(d, "value"));
        if (d.containsKey("idText"))
            e.setIdText(intVal(d, "idText"));
        if (d.containsKey("key"))
            e.setKey(str(d, "key"));
        if (d.containsKey("valueToAdd"))
            e.setValueToAdd(str(d, "valueToAdd"));
        if (d.containsKey("valueToRemove"))
            e.setValueToRemove(str(d, "valueToRemove"));
    }

    private void applyItemEffectFields(ItemEffectEntity e, Map<String, Object> d) {
        if (d.containsKey("idItem"))
            e.setIdItem(intVal(d, "idItem"));
        if (d.containsKey("effectCode"))
            e.setEffectCode(str(d, "effectCode"));
        if (d.containsKey("effectValue"))
            e.setEffectValue(intVal(d, "effectValue"));
    }

    private void applyWeatherRuleFields(WeatherRuleEntity e, Map<String, Object> d) {
        if (d.containsKey("probability"))
            e.setProbability(intVal(d, "probability"));
        if (d.containsKey("costMoveSafeLocation"))
            e.setCostMoveSafeLocation(intVal(d, "costMoveSafeLocation"));
        if (d.containsKey("costMoveNotSafeLocation"))
            e.setCostMoveNotSafeLocation(intVal(d, "costMoveNotSafeLocation"));
        if (d.containsKey("conditionKey"))
            e.setConditionKey(str(d, "conditionKey"));
        if (d.containsKey("conditionKeyValue"))
            e.setConditionKeyValue(str(d, "conditionKeyValue"));
        if (d.containsKey("timeFrom"))
            e.setTimeFrom(intVal(d, "timeFrom"));
        if (d.containsKey("timeTo"))
            e.setTimeTo(intVal(d, "timeTo"));
        if (d.containsKey("idText"))
            e.setIdText(intVal(d, "idText"));
        if (d.containsKey("active"))
            e.setActive(intVal(d, "active"));
        if (d.containsKey("priority"))
            e.setPriority(intVal(d, "priority"));
        if (d.containsKey("deltaEnergy"))
            e.setDeltaEnergy(intVal(d, "deltaEnergy"));
        if (d.containsKey("idEvent"))
            e.setIdEvent(intVal(d, "idEvent"));
    }

    private void applyGlobalRandomEventFields(GlobalRandomEventEntity e, Map<String, Object> d) {
        if (d.containsKey("conditionKey"))
            e.setConditionKey(str(d, "conditionKey"));
        if (d.containsKey("conditionValue"))
            e.setConditionValue(str(d, "conditionValue"));
        if (d.containsKey("probability"))
            e.setProbability(intVal(d, "probability"));
        if (d.containsKey("idText"))
            e.setIdText(intVal(d, "idText"));
        if (d.containsKey("idEvent"))
            e.setIdEvent(intVal(d, "idEvent"));
    }

    private void applyClassBonusFields(ClassBonusEntity e, Map<String, Object> d) {
        if (d.containsKey("idClass"))
            e.setIdClass(intVal(d, "idClass"));
        if (d.containsKey("statistic"))
            e.setStatistic(str(d, "statistic"));
        if (d.containsKey("value"))
            e.setValue(intVal(d, "value"));
    }

    private void applyMissionStepFields(MissionStepEntity e, Map<String, Object> d) {
        if (d.containsKey("idMission"))
            e.setIdMission(intVal(d, "idMission"));
        if (d.containsKey("step"))
            e.setStep(intVal(d, "step"));
    }
}
