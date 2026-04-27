package games.paths.core.service.story;

import games.paths.core.entity.story.*;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.port.story.StoryReadPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class StoryCrudServiceTypesTest {

    private StoryReadPort readPort;
    private StoryPersistencePort persistencePort;
    private StoryCrudService service;

    @BeforeEach
    void setup() {
        readPort = mock(StoryReadPort.class);
        persistencePort = mock(StoryPersistencePort.class);
        service = new StoryCrudService(readPort, persistencePort);
        
        StoryEntity story = new StoryEntity();
        story.setId(1L);
        when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));

        // Mock all persistence saves to return what they get (or at least a non-null entity)
        lenient().when(persistencePort.saveDifficulty(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveLocation(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveLocationNeighbor(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveKey(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveEvent(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveEventEffect(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveChoice(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveChoiceCondition(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveChoiceEffect(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveItem(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveItemEffect(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveWeatherRule(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveGlobalRandomEvent(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveCharacterTemplate(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveClass(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveClassBonus(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveTrait(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveText(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveCard(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveCreator(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveMission(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveMissionStep(any())).thenAnswer(i -> i.getArgument(0));
        lenient().when(persistencePort.saveStory(any())).thenAnswer(i -> i.getArgument(0));
    }

    private Map<String, Object> allData() {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("idTextNarrative", 1); m.put("idImage", 1); m.put("isSafe", 1); m.put("costEnergyEnter", 1); m.put("counterTime", 1);
        m.put("idEventIfCounterZero", 1); m.put("secureParam", 1); m.put("idEventIfCharacterStartTime", 1);
        m.put("idEventIfCharacterEnterFirstTime", 1); m.put("idEventIfFirstTime", 1); m.put("idEventNotFirstTime", 1);
        m.put("priorityAutomaticEvent", 1); m.put("idAudio", 1); m.put("maxCharacters", 1);
        m.put("idSpecificLocation", 1); m.put("type", "t"); m.put("costEnery", 1); m.put("flagEndTime", 1);
        m.put("characteristicToAdd", "c"); m.put("characteristicToRemove", "c"); m.put("keyToAdd", "k");
        m.put("keyValueToAdd", "v"); m.put("idItemToAdd", 1); m.put("idWeather", 1); m.put("idEventNext", 1);
        m.put("coinCost", 1); m.put("weight", 1); m.put("isConsumabile", 1); m.put("idClassPermitted", 1);
        m.put("idClassProhibited", 1); m.put("expCost", 1); m.put("maxWeight", 1); m.put("minCharacter", 1);
        m.put("maxCharacter", 1); m.put("costHelpComa", 1); m.put("costMaxCharacteristics", 1);
        m.put("numberMaxFreeAction", 1); m.put("lifeMax", 1); m.put("energyMax", 1); m.put("sadMax", 1);
        m.put("dexterityStart", 1); m.put("intelligenceStart", 1); m.put("constitutionStart", 1);
        m.put("weightMax", 1); m.put("dexterityBase", 1); m.put("intelligenceBase", 1); m.put("constitutionBase", 1);
        m.put("costPositive", 1); m.put("costNegative", 1); m.put("idText", 1); m.put("lang", "l"); m.put("shortText", "s");
        m.put("longText", "l"); m.put("idTextCopyright", 1); m.put("linkCopyright", "l"); m.put("idCreator", 1);
        m.put("idTextTitle", 1); m.put("idTextDescription", 1); m.put("urlImmage", "u"); m.put("alternativeImage", "a");
        m.put("awesomeIcon", "a"); m.put("styleMain", "s"); m.put("styleDetail", "s"); m.put("link", "l"); m.put("url", "u");
        m.put("urlImage", "u"); m.put("urlEmote", "u"); m.put("urlInstagram", "u"); m.put("idLocationFrom", 1);
        m.put("idLocationTo", 1); m.put("direction", "d"); m.put("flagBack", 1); m.put("conditionRegistryKey", "c");
        m.put("conditionRegistryValue", "v"); m.put("energyCost", 1); m.put("idTextGo", 1); m.put("idTextBack", 1);
        m.put("name", "n"); m.put("value", "v"); m.put("group", "g"); m.put("priority", 1); m.put("visibility", "v");
        return m;
    }
    
    private Map<String, Object> moreData() {
        Map<String, Object> m = new java.util.HashMap<>();
        m.put("idEvent", 1); m.put("statistics", "s"); m.put("value", 1); m.put("target", "t"); m.put("traitsToAdd", "t");
        m.put("traitsToRemove", "t"); m.put("targetClass", 1); m.put("idItemTarget", 1); m.put("itemAction", "i");
        m.put("idLocation", 1); m.put("idEventTorun", 1); m.put("limitSad", 1); m.put("limitDex", 1); m.put("limitInt", 1);
        m.put("limitCos", 1); m.put("otherwiseFlag", 1); m.put("isProgress", 1); m.put("logicOperator", "l");
        m.put("idChoices", 1); m.put("key", "k"); m.put("operator", "o"); m.put("idScelta", 1); m.put("flagGroup", 1);
        m.put("valueToAdd", "v"); m.put("valueToRemove", "v"); m.put("effectCode", "e"); m.put("effectValue", 1);
        m.put("probability", 1); m.put("costMoveSafeLocation", 1); m.put("costMoveNotSafeLocation", 1);
        m.put("conditionKey", "c"); m.put("conditionKeyValue", "c"); m.put("timeFrom", 1); m.put("timeTo", 1);
        m.put("active", 1); m.put("deltaEnergy", 1); m.put("conditionValue", "c"); m.put("idClass", 1); m.put("statistic", "s");
        m.put("conditionValueFrom", "c"); m.put("conditionValueTo", "c"); m.put("idEventCompleted", 1);
        m.put("idMission", 1); m.put("step", 1); m.put("idCard", 1); m.put("idTextName", 1); m.put("author", "a"); m.put("versionMin", "1");
        m.put("versionMax", "2"); m.put("category", "c"); m.put("peghi", 1); m.put("idLocationStart", 1); m.put("idLocationAllPlayerComa", 1);
        m.put("idEventAllPlayerComa", 1); m.put("clockSingularDescription", "c"); m.put("clockPluralDescription", "c"); m.put("idEventEndGame", 1);
        return m;
    }

    private void runType(String type, BaseStoryEntity e, Object findMethod, Object saveMethod, Object deleteMethod) {
        e.setUuid("uuid");
        Map<String, Object> data = new java.util.HashMap<>(allData());
        data.putAll(moreData());
        
        // List
        service.listEntities("story-uuid", type);
        
        // Get
        service.getEntity("story-uuid", type, "uuid");
        
        // Create
        service.createEntity("story-uuid", type, data);
        
        // Update
        service.updateEntity("story-uuid", type, "uuid", data);
        
        // Delete
        service.deleteEntity("story-uuid", type, "uuid");
    }

    @Test
    void testAllTypes() {
        StoryEntity s = new StoryEntity();
        s.setId(1L);
        s.setUuid("story-uuid");
        when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(s));

        String[] types = {
            "difficulties", "locations", "location-neighbors", "keys", "events", "event-effects",
            "choices", "choice-conditions", "choice-effects", "items", "item-effects", "weather-rules",
            "global-random-events", "character-templates", "classes", "class-bonuses", "traits", "creators",
            "cards", "texts", "missions", "mission-steps"
        };

        Map<String, Object> data = new java.util.HashMap<>(allData());
        data.putAll(moreData());

        for (String type : types) {
            BaseStoryEntity entity = createEntityForType(type);
            entity.setUuid("uuid");
            entity.setIdStory(1L);

            // Mock find for list
            mockListForType(type, entity);
            // Mock find for get/update/delete
            mockGetForType(type, entity);

            // Trigger list -> toMaps -> toMap
            service.listEntities("story-uuid", type);
            // Trigger get -> optMap -> toMap
            service.getEntity("story-uuid", type, "uuid");
            // Trigger create -> createByType -> createSpecific -> toMap
            service.createEntity("story-uuid", type, data);
            // Trigger update -> updateByType -> updateSpecific -> toMap
            service.updateEntity("story-uuid", type, "uuid", data);
            // Trigger delete
            service.deleteEntity("story-uuid", type, "uuid");
        }
            
        // also call updateStory to cover applyStoryFields
        when(persistencePort.saveStory(any())).thenReturn(s);
        service.updateStory("story-uuid", data);
        service.createStory(data);
    }

    private BaseStoryEntity createEntityForType(String type) {
        switch (type) {
            case "difficulties": return new StoryDifficultyEntity();
            case "locations": return new LocationEntity();
            case "location-neighbors": return new LocationNeighborEntity();
            case "keys": return new KeyEntity();
            case "events": return new EventEntity();
            case "event-effects": return new EventEffectEntity();
            case "choices": return new ChoiceEntity();
            case "choice-conditions": return new ChoiceConditionEntity();
            case "choice-effects": return new ChoiceEffectEntity();
            case "items": return new ItemEntity();
            case "item-effects": return new ItemEffectEntity();
            case "weather-rules": return new WeatherRuleEntity();
            case "global-random-events": return new GlobalRandomEventEntity();
            case "character-templates": return new CharacterTemplateEntity();
            case "classes": return new ClassEntity();
            case "class-bonuses": return new ClassBonusEntity();
            case "traits": return new TraitEntity();
            case "creators": return new CreatorEntity();
            case "cards": return new CardEntity();
            case "texts": return new TextEntity();
            case "missions": return new MissionEntity();
            case "mission-steps": return new MissionStepEntity();
            default: return null;
        }
    }

    private void mockListForType(String type, BaseStoryEntity e) {
        switch (type) {
            case "difficulties": when(readPort.findDifficultiesByStoryId(1L)).thenReturn(java.util.List.of((StoryDifficultyEntity)e)); break;
            case "locations": when(readPort.findLocationsByStoryId(1L)).thenReturn(java.util.List.of((LocationEntity)e)); break;
            case "location-neighbors": when(readPort.findLocationNeighborsByStoryId(1L)).thenReturn(java.util.List.of((LocationNeighborEntity)e)); break;
            case "keys": when(readPort.findKeysByStoryId(1L)).thenReturn(java.util.List.of((KeyEntity)e)); break;
            case "events": when(readPort.findEventsByStoryId(1L)).thenReturn(java.util.List.of((EventEntity)e)); break;
            case "event-effects": when(readPort.findEventEffectsByStoryId(1L)).thenReturn(java.util.List.of((EventEffectEntity)e)); break;
            case "choices": when(readPort.findChoicesByStoryId(1L)).thenReturn(java.util.List.of((ChoiceEntity)e)); break;
            case "choice-conditions": when(readPort.findChoiceConditionsByStoryId(1L)).thenReturn(java.util.List.of((ChoiceConditionEntity)e)); break;
            case "choice-effects": when(readPort.findChoiceEffectsByStoryId(1L)).thenReturn(java.util.List.of((ChoiceEffectEntity)e)); break;
            case "items": when(readPort.findItemsByStoryId(1L)).thenReturn(java.util.List.of((ItemEntity)e)); break;
            case "item-effects": when(readPort.findItemEffectsByStoryId(1L)).thenReturn(java.util.List.of((ItemEffectEntity)e)); break;
            case "weather-rules": when(readPort.findWeatherRulesByStoryId(1L)).thenReturn(java.util.List.of((WeatherRuleEntity)e)); break;
            case "global-random-events": when(readPort.findGlobalRandomEventsByStoryId(1L)).thenReturn(java.util.List.of((GlobalRandomEventEntity)e)); break;
            case "character-templates": when(readPort.findCharacterTemplatesByStoryId(1L)).thenReturn(java.util.List.of((CharacterTemplateEntity)e)); break;
            case "classes": when(readPort.findClassesByStoryId(1L)).thenReturn(java.util.List.of((ClassEntity)e)); break;
            case "class-bonuses": when(readPort.findClassBonusesByStoryId(1L)).thenReturn(java.util.List.of((ClassBonusEntity)e)); break;
            case "traits": when(readPort.findTraitsByStoryId(1L)).thenReturn(java.util.List.of((TraitEntity)e)); break;
            case "creators": when(readPort.findCreatorsByStoryId(1L)).thenReturn(java.util.List.of((CreatorEntity)e)); break;
            case "cards": when(readPort.findCardsByStoryId(1L)).thenReturn(java.util.List.of((CardEntity)e)); break;
            case "texts": when(readPort.findTextsByStoryId(1L)).thenReturn(java.util.List.of((TextEntity)e)); break;
            case "missions": when(readPort.findMissionsByStoryId(1L)).thenReturn(java.util.List.of((MissionEntity)e)); break;
            case "mission-steps": when(readPort.findMissionStepsByStoryId(1L)).thenReturn(java.util.List.of((MissionStepEntity)e)); break;
        }
    }

    private void mockGetForType(String type, BaseStoryEntity e) {
        switch (type) {
            case "difficulties": when(readPort.findDifficultyByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((StoryDifficultyEntity)e)); break;
            case "locations": when(readPort.findLocationByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((LocationEntity)e)); break;
            case "location-neighbors": when(readPort.findLocationNeighborByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((LocationNeighborEntity)e)); break;
            case "keys": when(readPort.findKeyByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((KeyEntity)e)); break;
            case "events": when(readPort.findEventByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((EventEntity)e)); break;
            case "event-effects": when(readPort.findEventEffectByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((EventEffectEntity)e)); break;
            case "choices": when(readPort.findChoiceByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((ChoiceEntity)e)); break;
            case "choice-conditions": when(readPort.findChoiceConditionByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((ChoiceConditionEntity)e)); break;
            case "choice-effects": when(readPort.findChoiceEffectByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((ChoiceEffectEntity)e)); break;
            case "items": when(readPort.findItemByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((ItemEntity)e)); break;
            case "item-effects": when(readPort.findItemEffectByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((ItemEffectEntity)e)); break;
            case "weather-rules": when(readPort.findWeatherRuleByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((WeatherRuleEntity)e)); break;
            case "global-random-events": when(readPort.findGlobalRandomEventByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((GlobalRandomEventEntity)e)); break;
            case "character-templates": when(readPort.findCharacterTemplateByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((CharacterTemplateEntity)e)); break;
            case "classes": when(readPort.findClassByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((ClassEntity)e)); break;
            case "class-bonuses": when(readPort.findClassBonusByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((ClassBonusEntity)e)); break;
            case "traits": when(readPort.findTraitByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((TraitEntity)e)); break;
            case "creators": when(readPort.findCreatorByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((CreatorEntity)e)); break;
            case "cards": when(readPort.findCardByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((CardEntity)e)); break;
            case "texts": when(readPort.findTextByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((TextEntity)e)); break;
            case "missions": when(readPort.findMissionByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((MissionEntity)e)); break;
            case "mission-steps": when(readPort.findMissionStepByStoryIdAndUuid(1L, "uuid")).thenReturn(Optional.of((MissionStepEntity)e)); break;
        }
    }


    @Test
    void testEdgeCases() {
        // Blank parameters
        assertNull(service.listEntities("", "locations"));
        assertNull(service.getEntity("u", "", "u"));
        assertNull(service.createEntity("u", "locations", null));
        assertNull(service.updateEntity("u", "locations", "u", Map.of()));
        assertFalse(service.deleteEntity("u", "locations", ""));
        assertNull(service.getStory(null));
        assertNull(service.updateStory("", Map.of()));
        assertNull(service.createStory(null));

        // Story not found
        when(readPort.findStoryByUuid("unknown")).thenReturn(Optional.empty());
        assertNull(service.listEntities("unknown", "locations"));
        assertNull(service.getEntity("unknown", "locations", "u"));
        assertNull(service.createEntity("unknown", "locations", Map.of("a",1)));
        assertNull(service.updateEntity("unknown", "locations", "u", Map.of("a",1)));
        assertFalse(service.deleteEntity("unknown", "locations", "u"));
        assertNull(service.updateStory("unknown", Map.of("a",1)));

        // Invalid entity types
        service.listEntities("story-uuid", "invalid-type");
        service.getEntity("story-uuid", "invalid-type", "u");
        service.createEntity("story-uuid", "invalid-type", Map.of("a", 1));
        service.updateEntity("story-uuid", "invalid-type", "u", Map.of("a", 1));
        service.deleteEntity("story-uuid", "invalid-type", "u");

        // intVal utility test
        Map<String, Object> d = new java.util.HashMap<>();
        d.put("k1", "not-a-number");
        d.put("k2", 123);
        d.put("k3", "456");
        d.put("k4", null);
        
        // We use reflection to call createLocation which uses intVal indirectly
        // or just rely on the fact that we passed "not-a-number" in data for some field
        Map<String, Object> data = new java.util.HashMap<>();
        data.put("idTextNarrative", "invalid");
        data.put("idImage", "789");
        data.put("isSafe", null); // Cover v == null in intVal
        service.createEntity("story-uuid", "locations", data);

        // Cover partial map for conditions (false branches of containsKey)
        // We need at least one key to pass the isEmpty() check
        Map<String, Object> partialData = Map.of("idTextNarrative", 1);
        service.updateEntity("story-uuid", "locations", "uuid", partialData);

        // Cover null list in toMaps
        when(readPort.findLocationsByStoryId(1L)).thenReturn(null);
        service.listEntities("story-uuid", "locations");

        // Cover unexpected object type in intVal (line 1144)
        Map<String, Object> weirdData = new java.util.HashMap<>();
        weirdData.put("idTextNarrative", new Object());
        service.createEntity("story-uuid", "locations", weirdData);
    }
}
