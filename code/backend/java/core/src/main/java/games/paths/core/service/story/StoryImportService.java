package games.paths.core.service.story;

import games.paths.core.entity.story.*;
import games.paths.core.model.story.StoryImportResult;
import games.paths.core.port.story.StoryImportPort;
import games.paths.core.port.story.StoryPersistencePort;

import java.util.*;

/**
 * StoryImportService - Domain service implementing story import and management.
 * Handles the complete lifecycle of importing a story from a structured data map,
 * including replace-on-conflict semantics and cascading deletes.
 * Ports are injected via constructor by the launcher configuration.
 */
public class StoryImportService implements StoryImportPort {

    private final StoryPersistencePort persistencePort;
    private final ThreadLocal<Map<String, Long>> scopedIdCache = ThreadLocal.withInitial(HashMap::new);

    public StoryImportService(StoryPersistencePort persistencePort) {
        this.persistencePort = persistencePort;
    }

    @Override
    public StoryImportResult importStory(Map<String, Object> storyData) {
        scopedIdCache.get().clear();
        try {
        if (storyData == null || storyData.isEmpty()) {
            throw new IllegalArgumentException("storyData must not be null or empty");
        }

        // Extract story header
        String uuid = getString(storyData, "uuid");
        if (uuid == null || uuid.isBlank()) {
            uuid = UUID.randomUUID().toString();
        }

        // If story already exists, delete it first (replace semantics)
        Optional<StoryEntity> existing = persistencePort.findStoryByUuid(uuid);
        if (existing.isPresent()) {
            persistencePort.deleteStoryData(existing.get().getId());
        }

        // Create story entity
        StoryEntity story = new StoryEntity();
        Long storyIdInput = getLong(storyData, "id", "idStory", "id_story");
        if (storyIdInput != null) {
            ensureIdAvailable("story/list_stories", storyIdInput, persistencePort.existsStoryId(storyIdInput));
            story.setId(storyIdInput);
        }
        story.setUuid(uuid);
        story.setAuthor(getString(storyData, "author"));
        story.setVersionMin(getString(storyData, "versionMin"));
        story.setVersionMax(getString(storyData, "versionMax"));
        story.setIdTextClockSingular(getInteger(storyData, "idTextClockSingular"));
        story.setIdTextClockPlural(getInteger(storyData, "idTextClockPlural"));
        story.setLinkCopyright(getString(storyData, "linkCopyright"));
        story.setCategory(getString(storyData, "category"));
        story.setGroup(getString(storyData, "group"));
        story.setVisibility(getString(storyData, "visibility"));
        story.setPriority(getInteger(storyData, "priority"));
        story.setPeghi(getInteger(storyData, "peghi"));

        StoryEntity savedStory = persistencePort.saveStory(story);
        Long storyId = savedStory.getId();

        // Import texts
        int textsImported = importTexts(storyData, storyId);

        // Update story text references after texts are imported
        savedStory.setIdTextTitle(getInteger(storyData, "idTextTitle"));
        savedStory.setIdTextDescription(getInteger(storyData, "idTextDescription"));
        savedStory.setIdTextCopyright(getInteger(storyData, "idTextCopyright"));
        persistencePort.saveStory(savedStory);

        // Import sub-entities
        int difficultiesImported = importDifficulties(storyData, storyId);
        int classesImported = importClasses(storyData, storyId);
        int locationsImported = importLocations(storyData, storyId);
        int eventsImported = importEvents(storyData, storyId);
        int itemsImported = importItems(storyData, storyId);
        int choicesImported = importChoices(storyData, storyId);
        importCreators(storyData, storyId);
        importCards(storyData, storyId);
        importKeys(storyData, storyId);
        importTraits(storyData, storyId);
        importCharacterTemplates(storyData, storyId);
        importWeatherRules(storyData, storyId);
        importGlobalRandomEvents(storyData, storyId);
        importMissions(storyData, storyId);
        importLocationNeighbors(storyData, storyId);
        importEventEffects(storyData, storyId);
        importItemEffects(storyData, storyId);
        importChoiceConditions(storyData, storyId);
        importChoiceEffects(storyData, storyId);
        importClassBonuses(storyData, storyId);
        importMissionSteps(storyData, storyId);
        persistencePort.syncStorySequences();

        return StoryImportResult.builder()
                .storyUuid(savedStory.getUuid())
                .status("IMPORTED")
                .textsImported(textsImported)
                .locationsImported(locationsImported)
                .eventsImported(eventsImported)
                .itemsImported(itemsImported)
                .difficultiesImported(difficultiesImported)
                .classesImported(classesImported)
                .choicesImported(choicesImported)
                .build();
        } finally {
            scopedIdCache.remove();
        }
    }

    @Override
    public boolean deleteStory(String uuid) {
        if (uuid == null || uuid.isBlank()) {
            return false;
        }
        Optional<StoryEntity> existing = persistencePort.findStoryByUuid(uuid);
        if (existing.isEmpty()) {
            return false;
        }
        persistencePort.deleteStoryData(existing.get().getId());
        return true;
    }

    @Override
    public List<String> listStoryUuids() {
        Optional<StoryEntity> dummy = persistencePort.findStoryByUuid("__list_all__");
        // Use persistence port iteration - not ideal but works with current port design
        // In practice the admin controller will call StoryQueryPort.listAllStories() instead
        return List.of();
    }

    // === Private Import Helpers ===

    private int importTexts(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "texts");
        if (items.isEmpty()) return 0;

        List<TextEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            TextEntity e = new TextEntity();
            e.setId(resolveStoryScopedId(item, "story/list_texts", "list_texts", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdText(getInteger(item, "idText"));
            e.setLang(getString(item, "lang") != null ? getString(item, "lang") : "en");
            e.setShortText(getString(item, "shortText"));
            e.setLongText(getString(item, "longText"));
            e.setIdTextCopyright(getInteger(item, "idTextCopyright"));
            e.setLinkCopyright(getString(item, "linkCopyright"));
            e.setIdCreator(getInteger(item, "idCreator"));
            entities.add(e);
        }
        return persistencePort.saveTexts(entities).size();
    }

    private int importDifficulties(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "difficulties");
        if (items.isEmpty()) return 0;

        List<StoryDifficultyEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            StoryDifficultyEntity e = new StoryDifficultyEntity();
            e.setId(resolveStoryScopedId(item, "story/list_stories_difficulty", "list_stories_difficulty", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setExpCost(getInteger(item, "expCost"));
            e.setMaxWeight(getInteger(item, "maxWeight"));
            e.setMinCharacter(getInteger(item, "minCharacter"));
            e.setMaxCharacter(getInteger(item, "maxCharacter"));
            e.setCostHelpComa(getInteger(item, "costHelpComa"));
            e.setCostMaxCharacteristics(getInteger(item, "costMaxCharacteristics"));
            e.setNumberMaxFreeAction(getInteger(item, "numberMaxFreeAction"));
            entities.add(e);
        }
        return persistencePort.saveDifficulties(entities).size();
    }

    private int importClasses(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "classes");
        if (items.isEmpty()) return 0;

        List<ClassEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            ClassEntity e = new ClassEntity();
            e.setId(resolveStoryScopedId(item, "story/list_classes", "list_classes", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdTextName(getInteger(item, "idTextName"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setWeightMax(getInteger(item, "weightMax"));
            e.setDexterityBase(getInteger(item, "dexterityBase"));
            e.setIntelligenceBase(getInteger(item, "intelligenceBase"));
            e.setConstitutionBase(getInteger(item, "constitutionBase"));
            entities.add(e);
        }
        return persistencePort.saveClasses(entities).size();
    }

    private int importLocations(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "locations");
        if (items.isEmpty()) return 0;

        List<LocationEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            LocationEntity e = new LocationEntity();
            e.setId(resolveStoryScopedId(item, "story/list_locations", "list_locations", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdTextName(getInteger(item, "idTextName"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setIdTextNarrative(getInteger(item, "idTextNarrative"));
            e.setIsSafe(getInteger(item, "isSafe"));
            e.setCostEnergyEnter(getInteger(item, "costEnergyEnter"));
            e.setCounterTime(getInteger(item, "counterTime"));
            e.setMaxCharacters(getInteger(item, "maxCharacters"));
            entities.add(e);
        }
        return persistencePort.saveLocations(entities).size();
    }

    private int importEvents(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "events");
        if (items.isEmpty()) return 0;

        List<EventEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            EventEntity e = new EventEntity();
            e.setId(resolveStoryScopedId(item, "story/list_events", "list_events", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdTextName(getInteger(item, "idTextName"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setType(getString(item, "type"));
            e.setCostEnery(getInteger(item, "costEnery"));
            e.setFlagEndTime(getInteger(item, "flagEndTime"));
            e.setCharacteristicToAdd(getString(item, "characteristicToAdd"));
            e.setCharacteristicToRemove(getString(item, "characteristicToRemove"));
            e.setKeyToAdd(getString(item, "keyToAdd"));
            e.setKeyValueToAdd(getString(item, "keyValueToAdd"));
            e.setCoinCost(getInteger(item, "coinCost"));
            entities.add(e);
        }
        return persistencePort.saveEvents(entities).size();
    }

    private int importItems(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "items");
        if (items.isEmpty()) return 0;

        List<ItemEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            ItemEntity e = new ItemEntity();
            e.setId(resolveStoryScopedId(item, "story/list_items", "list_items", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdTextName(getInteger(item, "idTextName"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setWeight(getInteger(item, "weight"));
            e.setIsConsumabile(getInteger(item, "isConsumabile"));
            entities.add(e);
        }
        return persistencePort.saveItems(entities).size();
    }

    private int importChoices(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "choices");
        if (items.isEmpty()) return 0;

        List<ChoiceEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            ChoiceEntity e = new ChoiceEntity();
            e.setId(resolveStoryScopedId(item, "story/list_choices", "list_choices", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdTextName(getInteger(item, "idTextName"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setIdTextNarrative(getInteger(item, "idTextNarrative"));
            e.setPriority(getInteger(item, "priority"));
            e.setOtherwiseFlag(getInteger(item, "otherwiseFlag"));
            e.setIsProgress(getInteger(item, "isProgress"));
            e.setLogicOperator(getString(item, "logicOperator"));
            entities.add(e);
        }
        return persistencePort.saveChoices(entities).size();
    }

    private void importCreators(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "creators");
        if (items.isEmpty()) return;

        List<CreatorEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            CreatorEntity e = new CreatorEntity();
            e.setId(resolveStoryScopedId(item, "story/list_creator", "list_creator", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdText(getInteger(item, "idText"));
            e.setLink(getString(item, "link"));
            e.setUrl(getString(item, "url"));
            e.setUrlImage(getString(item, "urlImage"));
            e.setUrlEmote(getString(item, "urlEmote"));
            e.setUrlInstagram(getString(item, "urlInstagram"));
            entities.add(e);
        }
        persistencePort.saveCreators(entities);
    }

    private void importCards(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "cards");
        if (items.isEmpty()) return;

        List<CardEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            CardEntity e = new CardEntity();
            e.setId(resolveStoryScopedId(item, "story/list_cards", "list_cards", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setUrlImmage(getString(item, "urlImmage"));
            e.setIdTextTitle(getInteger(item, "idTextTitle"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setIdTextCopyright(getInteger(item, "idTextCopyright"));
            e.setLinkCopyright(getString(item, "linkCopyright"));
            e.setAlternativeImage(getString(item, "alternativeImage"));
            e.setAwesomeIcon(getString(item, "awesomeIcon"));
            e.setStyleMain(getString(item, "styleMain"));
            e.setStyleDetail(getString(item, "styleDetail"));
            entities.add(e);
        }
        persistencePort.saveCards(entities);
    }

    private void importKeys(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "keys");
        if (items.isEmpty()) return;

        List<KeyEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            KeyEntity e = new KeyEntity();
            e.setId(resolveStoryScopedId(item, "story/list_keys", "list_keys", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setName(getString(item, "name"));
            e.setValue(getString(item, "value"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setGroup(getString(item, "group"));
            e.setPriority(getInteger(item, "priority"));
            e.setVisibility(getString(item, "visibility"));
            entities.add(e);
        }
        persistencePort.saveKeys(entities);
    }

    private void importTraits(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "traits");
        if (items.isEmpty()) return;

        List<TraitEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            TraitEntity e = new TraitEntity();
            e.setId(resolveStoryScopedId(item, "story/list_traits", "list_traits", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdTextName(getInteger(item, "idTextName"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setCostPositive(getInteger(item, "costPositive"));
            e.setCostNegative(getInteger(item, "costNegative"));
            entities.add(e);
        }
        persistencePort.saveTraits(entities);
    }

    private void importCharacterTemplates(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "characterTemplates");
        if (items.isEmpty()) return;

        List<CharacterTemplateEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            CharacterTemplateEntity e = new CharacterTemplateEntity();
            e.setIdTipo(resolveStoryScopedId(item, "story/list_character_templates", "list_character_templates", "id_tipo", storyId, "id", "idTipo", "id_tipo"));
            e.setIdStory(storyId);
            e.setIdTextName(getInteger(item, "idTextName"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setLifeMax(getInteger(item, "lifeMax"));
            e.setEnergyMax(getInteger(item, "energyMax"));
            e.setSadMax(getInteger(item, "sadMax"));
            e.setDexterityStart(getInteger(item, "dexterityStart"));
            e.setIntelligenceStart(getInteger(item, "intelligenceStart"));
            e.setConstitutionStart(getInteger(item, "constitutionStart"));
            entities.add(e);
        }
        persistencePort.saveCharacterTemplates(entities);
    }

    private void importWeatherRules(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "weatherRules");
        if (items.isEmpty()) return;

        List<WeatherRuleEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            WeatherRuleEntity e = new WeatherRuleEntity();
            e.setId(resolveStoryScopedId(item, "story/list_weather_rules", "list_weather_rules", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdTextName(getInteger(item, "idTextName"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            e.setProbability(getInteger(item, "probability"));
            e.setCostMoveSafeLocation(getInteger(item, "costMoveSafeLocation"));
            e.setCostMoveNotSafeLocation(getInteger(item, "costMoveNotSafeLocation"));
            e.setConditionKey(getString(item, "conditionKey"));
            e.setConditionKeyValue(getString(item, "conditionKeyValue"));
            e.setActive(getInteger(item, "active"));
            e.setPriority(getInteger(item, "priority"));
            e.setDeltaEnergy(getInteger(item, "deltaEnergy"));
            entities.add(e);
        }
        persistencePort.saveWeatherRules(entities);
    }

    private void importGlobalRandomEvents(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "globalRandomEvents");
        if (items.isEmpty()) return;

        List<GlobalRandomEventEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            GlobalRandomEventEntity e = new GlobalRandomEventEntity();
            e.setId(resolveStoryScopedId(item, "story/list_global_random_events", "list_global_random_events", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setConditionKey(getString(item, "conditionKey"));
            e.setConditionValue(getString(item, "conditionValue"));
            e.setProbability(getInteger(item, "probability"));
            entities.add(e);
        }
        persistencePort.saveGlobalRandomEvents(entities);
    }

    private void importMissions(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "missions");
        if (items.isEmpty()) return;

        List<MissionEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            MissionEntity e = new MissionEntity();
            e.setId(resolveStoryScopedId(item, "story/list_missions", "list_missions", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setConditionKey(getString(item, "conditionKey"));
            e.setConditionValueFrom(getString(item, "conditionValueFrom"));
            e.setConditionValueTo(getString(item, "conditionValueTo"));
            e.setIdTextName(getInteger(item, "idTextName"));
            e.setIdTextDescription(getInteger(item, "idTextDescription"));
            entities.add(e);
        }
        persistencePort.saveMissions(entities);
    }

    private void importLocationNeighbors(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "locationNeighbors");
        if (items.isEmpty()) return;

        List<LocationNeighborEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            LocationNeighborEntity e = new LocationNeighborEntity();
            e.setId(resolveStoryScopedId(item, "story/list_locations_neighbors", "list_locations_neighbors", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdLocationFrom(getInteger(item, "idLocationFrom"));
            e.setIdLocationTo(getInteger(item, "idLocationTo"));
            e.setDirection(getString(item, "direction"));
            e.setFlagBack(getInteger(item, "flagBack"));
            e.setConditionRegistryKey(getString(item, "conditionRegistryKey"));
            e.setConditionRegistryValue(getString(item, "conditionRegistryValue"));
            e.setEnergyCost(getInteger(item, "energyCost"));
            e.setIdTextGo(getInteger(item, "idTextGo"));
            e.setIdTextBack(getInteger(item, "idTextBack"));
            entities.add(e);
        }
        persistencePort.saveLocationNeighbors(entities);
    }

    private void importEventEffects(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "eventEffects");
        if (items.isEmpty()) return;

        List<EventEffectEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            EventEffectEntity e = new EventEffectEntity();
            e.setId(resolveStoryScopedId(item, "story/list_events_effects", "list_events_effects", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdEvent(getInteger(item, "idEvent"));
            e.setStatistics(getString(item, "statistics"));
            e.setValue(getInteger(item, "value"));
            e.setTarget(getString(item, "target"));
            e.setTraitsToAdd(getString(item, "traitsToAdd"));
            e.setTraitsToRemove(getString(item, "traitsToRemove"));
            e.setTargetClass(getInteger(item, "targetClass"));
            e.setIdItemTarget(getInteger(item, "idItemTarget"));
            e.setItemAction(getString(item, "itemAction"));
            entities.add(e);
        }
        persistencePort.saveEventEffects(entities);
    }

    private void importItemEffects(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "itemEffects");
        if (items.isEmpty()) return;

        List<ItemEffectEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            ItemEffectEntity e = new ItemEffectEntity();
            e.setId(resolveStoryScopedId(item, "story/list_items_effects", "list_items_effects", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdItem(getInteger(item, "idItem"));
            e.setEffectCode(getString(item, "effectCode"));
            e.setEffectValue(getInteger(item, "effectValue"));
            entities.add(e);
        }
        persistencePort.saveItemEffects(entities);
    }

    private void importChoiceConditions(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "choiceConditions");
        if (items.isEmpty()) return;

        List<ChoiceConditionEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            ChoiceConditionEntity e = new ChoiceConditionEntity();
            e.setId(resolveStoryScopedId(item, "story/list_choices_conditions", "list_choices_conditions", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdChoices(getInteger(item, "idChoices"));
            e.setType(getString(item, "type"));
            e.setKey(getString(item, "key"));
            e.setValue(getString(item, "value"));
            e.setOperator(getString(item, "operator"));
            entities.add(e);
        }
        persistencePort.saveChoiceConditions(entities);
    }

    private void importChoiceEffects(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "choiceEffects");
        if (items.isEmpty()) return;

        List<ChoiceEffectEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            ChoiceEffectEntity e = new ChoiceEffectEntity();
            e.setId(resolveStoryScopedId(item, "story/list_choices_effects", "list_choices_effects", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdChoices(getInteger(item, "idChoices"));
            e.setIdScelta(getInteger(item, "idScelta"));
            e.setFlagGroup(getInteger(item, "flagGroup"));
            e.setStatistics(getString(item, "statistics"));
            e.setValue(getInteger(item, "value"));
            e.setIdText(getInteger(item, "idText"));
            e.setKey(getString(item, "key"));
            e.setValueToAdd(getString(item, "valueToAdd"));
            e.setValueToRemove(getString(item, "valueToRemove"));
            entities.add(e);
        }
        persistencePort.saveChoiceEffects(entities);
    }

    private void importClassBonuses(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "classBonuses");
        if (items.isEmpty()) return;

        List<ClassBonusEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            ClassBonusEntity e = new ClassBonusEntity();
            e.setId(resolveStoryScopedId(item, "story/list_classes_bonus", "list_classes_bonus", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdClass(getInteger(item, "idClass"));
            e.setStatistic(getString(item, "statistic"));
            e.setValue(getInteger(item, "value"));
            entities.add(e);
        }
        persistencePort.saveClassBonuses(entities);
    }

    private void importMissionSteps(Map<String, Object> data, Long storyId) {
        List<Map<String, Object>> items = getList(data, "missionSteps");
        if (items.isEmpty()) return;

        List<MissionStepEntity> entities = new ArrayList<>();
        for (Map<String, Object> item : items) {
            MissionStepEntity e = new MissionStepEntity();
            e.setId(resolveStoryScopedId(item, "story/list_missions_steps", "list_missions_steps", "id", storyId, "id"));
            e.setIdStory(storyId);
            e.setIdMission(getInteger(item, "idMission"));
            e.setStep(getInteger(item, "step"));
            entities.add(e);
        }
        persistencePort.saveMissionSteps(entities);
    }

    // === Utility Methods ===

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> getList(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value instanceof List<?>) {
            return (List<Map<String, Object>>) value;
        }
        return List.of();
    }

    private String getString(Map<String, Object> data, String key) {
        Object value = data.get(key);
        return value != null ? value.toString() : null;
    }

    private Integer getInteger(Map<String, Object> data, String key) {
        Object value = data.get(key);
        if (value instanceof Number) {
            return ((Number) value).intValue();
        }
        if (value instanceof String) {
            try {
                return Integer.parseInt((String) value);
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private Long getLong(Map<String, Object> data, String... keys) {
        if (data == null || keys == null) return null;
        for (String key : keys) {
            Object value = data.get(key);
            if (value instanceof Number) {
                return ((Number) value).longValue();
            }
            if (value instanceof String) {
                try {
                    return Long.parseLong((String) value);
                } catch (NumberFormatException ignored) {
                    // try next key
                }
            }
        }
        return null;
    }

    private void ensureIdAvailable(String scope, Long id, boolean exists) {
        if (exists) {
            throw new IllegalArgumentException(scope + " id=" + id + " already present");
        }
    }

    private Long resolveStoryScopedId(
            Map<String, Object> data,
            String scope,
            String tableName,
            String idColumn,
            Long idStory,
            String... keys) {
        Map<String, Long> cache = scopedIdCache.get();
        boolean useScopedGeneration = switch (tableName) {
            case "list_events",
                 "list_events_effects",
                 "list_choices",
                 "list_choices_conditions",
                 "list_choices_effects",
                 "list_global_random_events",
                 "list_missions",
                 "list_missions_steps",
                 "list_locations_neighbors",
                 "list_items_effects",
                 "list_classes_bonus" -> true;
            default -> false;
        };
        String cacheScope = useScopedGeneration ? String.valueOf(idStory) : "GLOBAL";
        String cacheKey = tableName + "#" + idColumn + "#" + cacheScope;
        Long idInput = getLong(data, keys);
        if (idInput != null) {
            boolean exists = switch (scope) {
                case "story/list_texts" -> persistencePort.existsTextId(idInput, idStory);
                case "story/list_stories_difficulty" -> persistencePort.existsDifficultyId(idInput, idStory);
                case "story/list_creator" -> persistencePort.existsCreatorId(idInput, idStory);
                case "story/list_cards" -> persistencePort.existsCardId(idInput, idStory);
                case "story/list_keys" -> persistencePort.existsKeyId(idInput, idStory);
                case "story/list_classes" -> persistencePort.existsClassId(idInput, idStory);
                case "story/list_traits" -> persistencePort.existsTraitId(idInput, idStory);
                case "story/list_character_templates" -> persistencePort.existsCharacterTemplateId(idInput, idStory);
                case "story/list_locations" -> persistencePort.existsLocationId(idInput, idStory);
                case "story/list_events" -> persistencePort.existsEventId(idInput, idStory);
                case "story/list_items" -> persistencePort.existsItemId(idInput, idStory);
                case "story/list_choices" -> persistencePort.existsChoiceId(idInput, idStory);
                case "story/list_weather_rules" -> persistencePort.existsWeatherRuleId(idInput, idStory);
                case "story/list_global_random_events" -> persistencePort.existsGlobalRandomEventId(idInput, idStory);
                case "story/list_missions" -> persistencePort.existsMissionId(idInput, idStory);
                case "story/list_locations_neighbors" -> persistencePort.existsLocationNeighborId(idInput, idStory);
                case "story/list_events_effects" -> persistencePort.existsEventEffectId(idInput, idStory);
                case "story/list_items_effects" -> persistencePort.existsItemEffectId(idInput, idStory);
                case "story/list_choices_conditions" -> persistencePort.existsChoiceConditionId(idInput, idStory);
                case "story/list_choices_effects" -> persistencePort.existsChoiceEffectId(idInput, idStory);
                case "story/list_classes_bonus" -> persistencePort.existsClassBonusId(idInput, idStory);
                case "story/list_missions_steps" -> persistencePort.existsMissionStepId(idInput, idStory);
                default -> false;
            };
            ensureIdAvailable(scope, idInput, exists);
            Long cachedNext = cache.get(cacheKey);
            if (cachedNext == null || cachedNext <= idInput) {
                cache.put(cacheKey, idInput + 1);
            }
            return idInput;
        }

        if (useScopedGeneration && idStory == null) {
            return null;
        }

        Long next = cache.get(cacheKey);
        if (next == null) {
            next = useScopedGeneration
                    ? persistencePort.nextStoryScopedId(tableName, idColumn, idStory)
                    : persistencePort.nextGlobalId(tableName, idColumn);
        }
        cache.put(cacheKey, next + 1);
        return next;
    }
}
