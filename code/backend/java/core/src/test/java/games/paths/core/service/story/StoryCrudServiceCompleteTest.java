package games.paths.core.service.story;

import games.paths.core.entity.story.*;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.port.story.StoryReadPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit test per StoryCrudService.
 * Copre tutti i branch pubblici e privati per raggiungere 100% di coverage
 * SonarQube.
 */
@ExtendWith(MockitoExtension.class)
class StoryCrudServiceCompleteTest {

    @Mock
    private StoryReadPort readPort;
    @Mock
    private StoryPersistencePort persistencePort;

    private StoryCrudService service;

    // ─── entità helper ────────────────────────────────────────────────────────

    private StoryEntity story() {
        StoryEntity s = new StoryEntity();
        s.setId(1L);
        s.setUuid("story-uuid");
        s.setIdStory(1L);
        return s;
    }

    /** Crea un'entità base con getId() tramite riflessione funzionante. */
    private <T extends BaseStoryEntity> T base(T e) {
        e.setUuid("ent-uuid");
        e.setIdStory(1L);
        return e;
    }

    // ─── setup ────────────────────────────────────────────────────────────────

    @BeforeEach
    void setUp() {
        service = new StoryCrudService(readPort, persistencePort);
    }

    // =========================================================================
    // listEntities
    // =========================================================================

    @Test
    void listEntities_nullStoryUuid_returnsNull() {
        assertNull(service.listEntities(null, "locations"));
    }

    @Test
    void listEntities_blankStoryUuid_returnsNull() {
        assertNull(service.listEntities("  ", "locations"));
    }

    @Test
    void listEntities_nullEntityType_returnsNull() {
        assertNull(service.listEntities("uuid", null));
    }

    @Test
    void listEntities_storyNotFound_returnsNull() {
        when(readPort.findStoryByUuid("x")).thenReturn(Optional.empty());
        assertNull(service.listEntities("x", "locations"));
    }

    @Test
    void listEntities_difficulties() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        StoryDifficultyEntity d = base(new StoryDifficultyEntity());
        when(readPort.findDifficultiesByStoryId(1L)).thenReturn(List.of(d));
        assertEquals(1, service.listEntities("s", "difficulties").size());
    }

    @Test
    void listEntities_locations() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findLocationsByStoryId(1L)).thenReturn(List.of(base(new LocationEntity())));
        assertEquals(1, service.listEntities("s", "locations").size());
    }

    @Test
    void listEntities_locationNeighbors() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findLocationNeighborsByStoryId(1L)).thenReturn(List.of(base(new LocationNeighborEntity())));
        assertEquals(1, service.listEntities("s", "location-neighbors").size());
    }

    @Test
    void listEntities_keys() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findKeysByStoryId(1L)).thenReturn(List.of(base(new KeyEntity())));
        assertEquals(1, service.listEntities("s", "keys").size());
    }

    @Test
    void listEntities_events() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findEventsByStoryId(1L)).thenReturn(List.of(base(new EventEntity())));
        assertEquals(1, service.listEntities("s", "events").size());
    }

    @Test
    void listEntities_eventEffects() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findEventEffectsByStoryId(1L)).thenReturn(List.of(base(new EventEffectEntity())));
        assertEquals(1, service.listEntities("s", "event-effects").size());
    }

    @Test
    void listEntities_choices() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findChoicesByStoryId(1L)).thenReturn(List.of(base(new ChoiceEntity())));
        assertEquals(1, service.listEntities("s", "choices").size());
    }

    @Test
    void listEntities_choiceConditions() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findChoiceConditionsByStoryId(1L)).thenReturn(List.of(base(new ChoiceConditionEntity())));
        assertEquals(1, service.listEntities("s", "choice-conditions").size());
    }

    @Test
    void listEntities_choiceEffects() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findChoiceEffectsByStoryId(1L)).thenReturn(List.of(base(new ChoiceEffectEntity())));
        assertEquals(1, service.listEntities("s", "choice-effects").size());
    }

    @Test
    void listEntities_items() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findItemsByStoryId(1L)).thenReturn(List.of(base(new ItemEntity())));
        assertEquals(1, service.listEntities("s", "items").size());
    }

    @Test
    void listEntities_itemEffects() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findItemEffectsByStoryId(1L)).thenReturn(List.of(base(new ItemEffectEntity())));
        assertEquals(1, service.listEntities("s", "item-effects").size());
    }

    @Test
    void listEntities_weatherRules() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findWeatherRulesByStoryId(1L)).thenReturn(List.of(base(new WeatherRuleEntity())));
        assertEquals(1, service.listEntities("s", "weather-rules").size());
    }

    @Test
    void listEntities_globalRandomEvents() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findGlobalRandomEventsByStoryId(1L)).thenReturn(List.of(base(new GlobalRandomEventEntity())));
        assertEquals(1, service.listEntities("s", "global-random-events").size());
    }

    @Test
    void listEntities_characterTemplates() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findCharacterTemplatesByStoryId(1L)).thenReturn(List.of(base(new CharacterTemplateEntity())));
        assertEquals(1, service.listEntities("s", "character-templates").size());
    }

    @Test
    void listEntities_classes() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findClassesByStoryId(1L)).thenReturn(List.of(base(new ClassEntity())));
        assertEquals(1, service.listEntities("s", "classes").size());
    }

    @Test
    void listEntities_classBonuses() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findClassBonusesByStoryId(1L)).thenReturn(List.of(base(new ClassBonusEntity())));
        assertEquals(1, service.listEntities("s", "class-bonuses").size());
    }

    @Test
    void listEntities_traits() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findTraitsByStoryId(1L)).thenReturn(List.of(base(new TraitEntity())));
        assertEquals(1, service.listEntities("s", "traits").size());
    }

    @Test
    void listEntities_creators() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findCreatorsByStoryId(1L)).thenReturn(List.of(base(new CreatorEntity())));
        assertEquals(1, service.listEntities("s", "creators").size());
    }

    @Test
    void listEntities_cards() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findCardsByStoryId(1L)).thenReturn(List.of(base(new CardEntity())));
        assertEquals(1, service.listEntities("s", "cards").size());
    }

    @Test
    void listEntities_texts() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findTextsByStoryId(1L)).thenReturn(List.of(base(new TextEntity())));
        assertEquals(1, service.listEntities("s", "texts").size());
    }

    @Test
    void listEntities_missions() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findMissionsByStoryId(1L)).thenReturn(List.of(base(new MissionEntity())));
        assertEquals(1, service.listEntities("s", "missions").size());
    }

    @Test
    void listEntities_missionSteps() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findMissionStepsByStoryId(1L)).thenReturn(List.of(base(new MissionStepEntity())));
        assertEquals(1, service.listEntities("s", "mission-steps").size());
    }

    @Test
    void listEntities_unknown_returnsEmpty() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        assertTrue(service.listEntities("s", "unknown").isEmpty());
    }

    @Test
    void listEntities_nullList_returnsEmpty() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findLocationsByStoryId(1L)).thenReturn(null);
        assertTrue(service.listEntities("s", "locations").isEmpty());
    }

    // =========================================================================
    // getEntity
    // =========================================================================

    @Test
    void getEntity_blankArgs_returnsNull() {
        assertNull(service.getEntity(null, "t", "u"));
        assertNull(service.getEntity("s", null, "u"));
        assertNull(service.getEntity("s", "t", null));
    }

    @Test
    void getEntity_storyNotFound_returnsNull() {
        when(readPort.findStoryByUuid("x")).thenReturn(Optional.empty());
        assertNull(service.getEntity("x", "locations", "u"));
    }

    @Test
    void getEntity_difficulties() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findDifficultyByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new StoryDifficultyEntity())));
        assertNotNull(service.getEntity("s", "difficulties", "u"));
    }

    @Test
    void getEntity_locations() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findLocationByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new LocationEntity())));
        assertNotNull(service.getEntity("s", "locations", "u"));
    }

    @Test
    void getEntity_locationNeighbors() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findLocationNeighborByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new LocationNeighborEntity())));
        assertNotNull(service.getEntity("s", "location-neighbors", "u"));
    }

    @Test
    void getEntity_keys() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findKeyByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new KeyEntity())));
        assertNotNull(service.getEntity("s", "keys", "u"));
    }

    @Test
    void getEntity_events() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findEventByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new EventEntity())));
        assertNotNull(service.getEntity("s", "events", "u"));
    }

    @Test
    void getEntity_eventEffects() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findEventEffectByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new EventEffectEntity())));
        assertNotNull(service.getEntity("s", "event-effects", "u"));
    }

    @Test
    void getEntity_choices() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findChoiceByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ChoiceEntity())));
        assertNotNull(service.getEntity("s", "choices", "u"));
    }

    @Test
    void getEntity_choiceConditions() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findChoiceConditionByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new ChoiceConditionEntity())));
        assertNotNull(service.getEntity("s", "choice-conditions", "u"));
    }

    @Test
    void getEntity_choiceEffects() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findChoiceEffectByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new ChoiceEffectEntity())));
        assertNotNull(service.getEntity("s", "choice-effects", "u"));
    }

    @Test
    void getEntity_items() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findItemByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ItemEntity())));
        assertNotNull(service.getEntity("s", "items", "u"));
    }

    @Test
    void getEntity_itemEffects() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findItemEffectByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ItemEffectEntity())));
        assertNotNull(service.getEntity("s", "item-effects", "u"));
    }

    @Test
    void getEntity_weatherRules() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findWeatherRuleByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new WeatherRuleEntity())));
        assertNotNull(service.getEntity("s", "weather-rules", "u"));
    }

    @Test
    void getEntity_globalRandomEvents() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findGlobalRandomEventByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new GlobalRandomEventEntity())));
        assertNotNull(service.getEntity("s", "global-random-events", "u"));
    }

    @Test
    void getEntity_characterTemplates() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findCharacterTemplateByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new CharacterTemplateEntity())));
        assertNotNull(service.getEntity("s", "character-templates", "u"));
    }

    @Test
    void getEntity_classes() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findClassByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ClassEntity())));
        assertNotNull(service.getEntity("s", "classes", "u"));
    }

    @Test
    void getEntity_classBonuses() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findClassBonusByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ClassBonusEntity())));
        assertNotNull(service.getEntity("s", "class-bonuses", "u"));
    }

    @Test
    void getEntity_traits() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findTraitByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new TraitEntity())));
        assertNotNull(service.getEntity("s", "traits", "u"));
    }

    @Test
    void getEntity_creators() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findCreatorByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new CreatorEntity())));
        assertNotNull(service.getEntity("s", "creators", "u"));
    }

    @Test
    void getEntity_cards() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findCardByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new CardEntity())));
        assertNotNull(service.getEntity("s", "cards", "u"));
    }

    @Test
    void getEntity_texts() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findTextByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new TextEntity())));
        assertNotNull(service.getEntity("s", "texts", "u"));
    }

    @Test
    void getEntity_missions() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findMissionByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new MissionEntity())));
        assertNotNull(service.getEntity("s", "missions", "u"));
    }

    @Test
    void getEntity_missionSteps() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findMissionStepByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new MissionStepEntity())));
        assertNotNull(service.getEntity("s", "mission-steps", "u"));
    }

    @Test
    void getEntity_unknown_returnsNull() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        assertNull(service.getEntity("s", "unknown", "u"));
    }

    @Test
    void getEntity_notFound_returnsNull() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        when(readPort.findLocationByStoryIdAndUuid(1L, "u")).thenReturn(Optional.empty());
        assertNull(service.getEntity("s", "locations", "u"));
    }

    // =========================================================================
    // getStory / updateStory / createStory
    // =========================================================================

    @Test
    void getStory_blank_returnsNull() {
        assertNull(service.getStory(null));
        assertNull(service.getStory(""));
    }

    @Test
    void getStory_notFound_returnsNull() {
        when(readPort.findStoryByUuid("x")).thenReturn(Optional.empty());
        assertNull(service.getStory("x"));
    }

    @Test
    void getStory_found_returnsMap() {
        StoryEntity s = story();
        s.setAuthor("Author");
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(s));
        Map<String, Object> result = service.getStory("s");
        assertTrue(result.containsKey("author"));
    }

    @Test
    void updateStory_blankArgs_returnsNull() {
        assertNull(service.updateStory(null, Map.of("k", "v")));
        assertNull(service.updateStory("s", null));
        assertNull(service.updateStory("s", Map.of()));
    }

    @Test
    void updateStory_notFound_returnsNull() {
        when(readPort.findStoryByUuid("x")).thenReturn(Optional.empty());
        assertNull(service.updateStory("x", Map.of("author", "A")));
    }

    @Test
    void updateStory_allFields() {
        StoryEntity s = story();
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(s));
        when(persistencePort.saveStory(any())).thenReturn(s);
        Map<String, Object> data = new HashMap<>();
        data.put("author", "Me");
        data.put("versionMin", "1");
        data.put("versionMax", "2");
        data.put("category", "RPG");
        data.put("group", "G1");
        data.put("visibility", "public");
        data.put("priority", 5);
        data.put("peghi", 3);
        data.put("idTextTitle", 10);
        data.put("idLocationStart", 11);
        data.put("idImage", 12);
        data.put("idLocationAllPlayerComa", 13);
        data.put("idEventAllPlayerComa", 14);
        data.put("clockSingularDescription", "ora");
        data.put("clockPluralDescription", "ore");
        data.put("idEventEndGame", 99);
        data.put("idTextCopyright", 50);
        data.put("linkCopyright", "http://link");
        data.put("idCreator", 7);
        data.put("idTextName", 1);
        data.put("idTextDescription", 2);
        data.put("idCard", 3);
        assertNotNull(service.updateStory("s", data));
    }

    @Test
    void createStory_nullData_returnsNull() {
        assertNull(service.createStory(null));
        assertNull(service.createStory(Map.of()));
    }

    @Test
    void createStory_success() {
        StoryEntity s = story();
        when(persistencePort.saveStory(any())).thenReturn(s);
        Map<String, Object> result = service.createStory(Map.of("author", "A"));
        assertNotNull(result);
    }

    // =========================================================================
    // createEntity – tutti i 22 tipi
    // =========================================================================

    @Test
    void createEntity_blankArgs_returnsNull() {
        assertNull(service.createEntity(null, "locations", Map.of("k", "v")));
        assertNull(service.createEntity("s", null, Map.of("k", "v")));
        assertNull(service.createEntity("s", "locations", null));
        assertNull(service.createEntity("s", "locations", Map.of()));
    }

    @Test
    void createEntity_storyNotFound_returnsNull() {
        when(readPort.findStoryByUuid("x")).thenReturn(Optional.empty());
        assertNull(service.createEntity("x", "locations", Map.of("k", "v")));
    }

    @Test
    void createEntity_unknown_returnsNull() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        assertNull(service.createEntity("s", "unknown", Map.of("k", "v")));
    }

    private Map<String, Object> setup_create(String type) {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        return Map.of("idTextName", 1, "idTextDescription", 2, "idCard", 3);
    }

    @Test
    void createEntity_difficulties() {
        Map<String, Object> d = setup_create("difficulties");
        StoryDifficultyEntity e = base(new StoryDifficultyEntity());
        when(persistencePort.saveDifficulty(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>(d);
        data.put("expCost", 10);
        data.put("maxWeight", 5);
        data.put("minCharacter", 1);
        data.put("maxCharacter", 4);
        data.put("costHelpComa", 2);
        data.put("costMaxCharacteristics", 3);
        data.put("numberMaxFreeAction", 1);
        assertNotNull(service.createEntity("s", "difficulties", data));
    }

    @Test
    void createEntity_locations() {
        setup_create("locations");
        LocationEntity e = base(new LocationEntity());
        when(persistencePort.saveLocation(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idTextNarrative", 2);
        data.put("idImage", 3);
        data.put("isSafe", 1);
        data.put("costEnergyEnter", 5);
        data.put("counterTime", 0);
        data.put("idEventIfCounterZero", 0);
        data.put("secureParam", 0);
        data.put("idEventIfCharacterStartTime", 0);
        data.put("idEventIfCharacterEnterFirstTime", 0);
        data.put("idEventIfFirstTime", 0);
        data.put("idEventNotFirstTime", 0);
        data.put("priorityAutomaticEvent", 1);
        data.put("idAudio", 0);
        data.put("maxCharacters", 10);
        assertNotNull(service.createEntity("s", "locations", data));
    }

    @Test
    void createEntity_locationNeighbors() {
        setup_create("location-neighbors");
        when(persistencePort.saveLocationNeighbor(any())).thenReturn(base(new LocationNeighborEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idLocationFrom", 1);
        data.put("idLocationTo", 2);
        data.put("direction", "N");
        data.put("flagBack", 0);
        data.put("conditionRegistryKey", "k");
        data.put("conditionRegistryValue", "v");
        data.put("energyCost", 3);
        data.put("idTextGo", 4);
        data.put("idTextBack", 5);
        assertNotNull(service.createEntity("s", "location-neighbors", data));
    }

    @Test
    void createEntity_keys() {
        setup_create("keys");
        when(persistencePort.saveKey(any())).thenReturn(base(new KeyEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("name", "myKey");
        data.put("value", "val");
        data.put("group", "g");
        data.put("priority", 1);
        data.put("visibility", "public");
        assertNotNull(service.createEntity("s", "keys", data));
    }

    @Test
    void createEntity_events() {
        setup_create("events");
        when(persistencePort.saveEvent(any())).thenReturn(base(new EventEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idSpecificLocation", 2);
        data.put("type", "T");
        data.put("costEnery", 1);
        data.put("flagEndTime", 0);
        data.put("characteristicToAdd", "STR");
        data.put("characteristicToRemove", "DEX");
        data.put("keyToAdd", "k");
        data.put("keyValueToAdd", "v");
        data.put("idItemToAdd", 5);
        data.put("idWeather", 6);
        data.put("idEventNext", 7);
        data.put("coinCost", 10);
        assertNotNull(service.createEntity("s", "events", data));
    }

    @Test
    void createEntity_eventEffects() {
        setup_create("event-effects");
        when(persistencePort.saveEventEffect(any())).thenReturn(base(new EventEffectEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idEvent", 2);
        data.put("statistics", "HP");
        data.put("value", 5);
        data.put("target", "PLAYER");
        data.put("traitsToAdd", "T1");
        data.put("traitsToRemove", "T2");
        data.put("targetClass", 3);
        data.put("idItemTarget", 4);
        data.put("itemAction", "USE");
        assertNotNull(service.createEntity("s", "event-effects", data));
    }

    @Test
    void createEntity_choices() {
        setup_create("choices");
        when(persistencePort.saveChoice(any())).thenReturn(base(new ChoiceEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idEvent", 2);
        data.put("idLocation", 3);
        data.put("priority", 1);
        data.put("idTextNarrative", 4);
        data.put("idEventTorun", 5);
        data.put("limitSad", 1);
        data.put("limitDex", 2);
        data.put("limitInt", 3);
        data.put("limitCos", 4);
        data.put("otherwiseFlag", 0);
        data.put("isProgress", 1);
        data.put("logicOperator", "AND");
        assertNotNull(service.createEntity("s", "choices", data));
    }

    @Test
    void createEntity_choiceConditions() {
        setup_create("choice-conditions");
        when(persistencePort.saveChoiceCondition(any())).thenReturn(base(new ChoiceConditionEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idChoices", 2);
        data.put("type", "T");
        data.put("key", "k");
        data.put("value", "v");
        data.put("operator", "EQ");
        assertNotNull(service.createEntity("s", "choice-conditions", data));
    }

    @Test
    void createEntity_choiceEffects() {
        setup_create("choice-effects");
        when(persistencePort.saveChoiceEffect(any())).thenReturn(base(new ChoiceEffectEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idChoices", 2);
        data.put("idScelta", 3);
        data.put("flagGroup", 0);
        data.put("statistics", "HP");
        data.put("value", 5);
        data.put("idText", 6);
        data.put("key", "k");
        data.put("valueToAdd", "+1");
        data.put("valueToRemove", "-1");
        assertNotNull(service.createEntity("s", "choice-effects", data));
    }

    @Test
    void createEntity_items() {
        setup_create("items");
        when(persistencePort.saveItem(any())).thenReturn(base(new ItemEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("weight", 2);
        data.put("isConsumabile", 1);
        data.put("idClassPermitted", 3);
        data.put("idClassProhibited", 4);
        assertNotNull(service.createEntity("s", "items", data));
    }

    @Test
    void createEntity_itemEffects() {
        setup_create("item-effects");
        when(persistencePort.saveItemEffect(any())).thenReturn(base(new ItemEffectEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idItem", 2);
        data.put("effectCode", "CODE");
        data.put("effectValue", 5);
        assertNotNull(service.createEntity("s", "item-effects", data));
    }

    @Test
    void createEntity_weatherRules() {
        setup_create("weather-rules");
        when(persistencePort.saveWeatherRule(any())).thenReturn(base(new WeatherRuleEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("probability", 50);
        data.put("costMoveSafeLocation", 1);
        data.put("costMoveNotSafeLocation", 2);
        data.put("conditionKey", "k");
        data.put("conditionKeyValue", "v");
        data.put("timeFrom", 8);
        data.put("timeTo", 20);
        data.put("idText", 3);
        data.put("active", 1);
        data.put("priority", 1);
        data.put("deltaEnergy", -1);
        data.put("idEvent", 9);
        assertNotNull(service.createEntity("s", "weather-rules", data));
    }

    @Test
    void createEntity_globalRandomEvents() {
        setup_create("global-random-events");
        when(persistencePort.saveGlobalRandomEvent(any())).thenReturn(base(new GlobalRandomEventEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("conditionKey", "k");
        data.put("conditionValue", "v");
        data.put("probability", 10);
        data.put("idText", 2);
        data.put("idEvent", 3);
        assertNotNull(service.createEntity("s", "global-random-events", data));
    }

    @Test
    void createEntity_characterTemplates() {
        setup_create("character-templates");
        when(persistencePort.saveCharacterTemplate(any())).thenReturn(base(new CharacterTemplateEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("lifeMax", 100);
        data.put("energyMax", 50);
        data.put("sadMax", 20);
        data.put("dexterityStart", 10);
        data.put("intelligenceStart", 8);
        data.put("constitutionStart", 12);
        assertNotNull(service.createEntity("s", "character-templates", data));
    }

    @Test
    void createEntity_classes() {
        setup_create("classes");
        when(persistencePort.saveClass(any())).thenReturn(base(new ClassEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("weightMax", 20);
        data.put("dexterityBase", 5);
        data.put("intelligenceBase", 6);
        data.put("constitutionBase", 7);
        assertNotNull(service.createEntity("s", "classes", data));
    }

    @Test
    void createEntity_classBonuses() {
        setup_create("class-bonuses");
        when(persistencePort.saveClassBonus(any())).thenReturn(base(new ClassBonusEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idClass", 2);
        data.put("statistic", "STR");
        data.put("value", 3);
        assertNotNull(service.createEntity("s", "class-bonuses", data));
    }

    @Test
    void createEntity_traits() {
        setup_create("traits");
        when(persistencePort.saveTrait(any())).thenReturn(base(new TraitEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idClassPermitted", 2);
        data.put("idClassProhibited", 3);
        data.put("costPositive", 5);
        data.put("costNegative", 3);
        assertNotNull(service.createEntity("s", "traits", data));
    }

    @Test
    void createEntity_texts() {
        setup_create("texts");
        when(persistencePort.saveText(any())).thenReturn(base(new TextEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idText", 10);
        data.put("lang", "it");
        data.put("shortText", "Ciao");
        data.put("longText", "Testo lungo");
        data.put("idTextCopyright", 20);
        data.put("linkCopyright", "http://c");
        data.put("idCreator", 5);
        assertNotNull(service.createEntity("s", "texts", data));
    }

    @Test
    void createEntity_cards() {
        setup_create("cards");
        when(persistencePort.saveCard(any())).thenReturn(base(new CardEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idTextTitle", 2);
        data.put("idTextDescription", 3);
        data.put("idTextCopyright", 4);
        data.put("linkCopyright", "http://c");
        data.put("idCreator", 5);
        data.put("urlImmage", "http://img");
        data.put("alternativeImage", "alt");
        data.put("awesomeIcon", "fa-star");
        data.put("styleMain", "main");
        data.put("styleDetail", "detail");
        assertNotNull(service.createEntity("s", "cards", data));
    }

    @Test
    void createEntity_creators() {
        setup_create("creators");
        when(persistencePort.saveCreator(any())).thenReturn(base(new CreatorEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idText", 2);
        data.put("link", "http://link");
        data.put("url", "http://url");
        data.put("urlImage", "http://img");
        data.put("urlEmote", "http://emote");
        data.put("urlInstagram", "http://ig");
        data.put("idCard", 99);
        Map<String, Object> result = service.createEntity("s", "creators", data);
        assertNotNull(result);
        
        org.mockito.ArgumentCaptor<CreatorEntity> captor = org.mockito.ArgumentCaptor.forClass(CreatorEntity.class);
        verify(persistencePort).saveCreator(captor.capture());
        assertEquals(99, captor.getValue().getIdCard());
    }

    @Test
    void createEntity_missions() {
        setup_create("missions");
        when(persistencePort.saveMission(any())).thenReturn(base(new MissionEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("conditionKey", "k");
        data.put("conditionValueFrom", "0");
        data.put("conditionValueTo", "10");
        data.put("idEventCompleted", 9);
        assertNotNull(service.createEntity("s", "missions", data));
    }

    @Test
    void createEntity_missionSteps() {
        setup_create("mission-steps");
        when(persistencePort.saveMissionStep(any())).thenReturn(base(new MissionStepEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("conditionKey", "k");
        data.put("conditionValueFrom", "0");
        data.put("conditionValueTo", "10");
        data.put("idEventCompleted", 9);
        data.put("idMission", 5);
        data.put("step", 1);
        assertNotNull(service.createEntity("s", "mission-steps", data));
    }

    // =========================================================================
    // updateEntity – tutti i 22 tipi
    // =========================================================================

    @Test
    void updateEntity_blankArgs_returnsNull() {
        assertNull(service.updateEntity(null, "t", "u", Map.of("k", "v")));
        assertNull(service.updateEntity("s", null, "u", Map.of("k", "v")));
        assertNull(service.updateEntity("s", "t", null, Map.of("k", "v")));
        assertNull(service.updateEntity("s", "t", "u", null));
        assertNull(service.updateEntity("s", "t", "u", Map.of()));
    }

    @Test
    void updateEntity_storyNotFound_returnsNull() {
        when(readPort.findStoryByUuid("x")).thenReturn(Optional.empty());
        assertNull(service.updateEntity("x", "locations", "u", Map.of("k", "v")));
    }

    @Test
    void updateEntity_unknown_returnsNull() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
        assertNull(service.updateEntity("s", "unknown", "u", Map.of("k", "v")));
    }

    private void setupStory() {
        when(readPort.findStoryByUuid("s")).thenReturn(Optional.of(story()));
    }

    @Test
    void updateEntity_difficulties_found() {
        setupStory();
        StoryDifficultyEntity e = base(new StoryDifficultyEntity());
        when(readPort.findDifficultyByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveDifficulty(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("expCost", 1);
        data.put("maxWeight", 2);
        data.put("minCharacter", 1);
        data.put("maxCharacter", 4);
        data.put("costHelpComa", 1);
        data.put("costMaxCharacteristics", 2);
        data.put("numberMaxFreeAction", 1);
        assertNotNull(service.updateEntity("s", "difficulties", "u", data));
    }

    @Test
    void updateEntity_difficulties_notFound() {
        setupStory();
        when(readPort.findDifficultyByStoryIdAndUuid(1L, "u")).thenReturn(Optional.empty());
        assertNull(service.updateEntity("s", "difficulties", "u", Map.of("expCost", 1)));
    }

    @Test
    void updateEntity_locations_found() {
        setupStory();
        LocationEntity e = base(new LocationEntity());
        when(readPort.findLocationByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveLocation(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextNarrative", 1);
        data.put("idImage", 2);
        data.put("isSafe", 1);
        data.put("costEnergyEnter", 3);
        data.put("counterTime", 0);
        data.put("idEventIfCounterZero", 0);
        data.put("secureParam", 0);
        data.put("idEventIfCharacterStartTime", 0);
        data.put("idEventIfCharacterEnterFirstTime", 0);
        data.put("idEventIfFirstTime", 0);
        data.put("idEventNotFirstTime", 0);
        data.put("priorityAutomaticEvent", 1);
        data.put("idAudio", 0);
        data.put("maxCharacters", 5);
        assertNotNull(service.updateEntity("s", "locations", "u", data));
    }

    @Test
    void updateEntity_locationNeighbors_found() {
        setupStory();
        LocationNeighborEntity e = base(new LocationNeighborEntity());
        when(readPort.findLocationNeighborByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveLocationNeighbor(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idLocationFrom", 1);
        data.put("idLocationTo", 2);
        data.put("direction", "S");
        data.put("flagBack", 0);
        data.put("conditionRegistryKey", "k");
        data.put("conditionRegistryValue", "v");
        data.put("energyCost", 2);
        data.put("idTextGo", 3);
        data.put("idTextGo", 3);
        data.put("idTextBack", 4);
        assertNotNull(service.updateEntity("s", "location-neighbors", "u", data));
    }

    @Test
    void updateEntity_keys_found() {
        setupStory();
        KeyEntity e = base(new KeyEntity());
        when(readPort.findKeyByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveKey(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("name", "k");
        data.put("value", "v");
        data.put("group", "g");
        data.put("priority", 1);
        data.put("visibility", "pub");
        assertNotNull(service.updateEntity("s", "keys", "u", data));
    }

    @Test
    void updateEntity_events_found() {
        setupStory();
        EventEntity e = base(new EventEntity());
        when(readPort.findEventByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveEvent(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idSpecificLocation", 2);
        data.put("type", "T");
        data.put("costEnery", 1);
        data.put("flagEndTime", 0);
        data.put("characteristicToAdd", "A");
        data.put("characteristicToRemove", "B");
        data.put("keyToAdd", "k");
        data.put("keyValueToAdd", "v");
        data.put("idItemToAdd", 3);
        data.put("idWeather", 4);
        data.put("idEventNext", 5);
        data.put("coinCost", 10);
        assertNotNull(service.updateEntity("s", "events", "u", data));
    }

    @Test
    void updateEntity_eventEffects_found() {
        setupStory();
        EventEffectEntity e = base(new EventEffectEntity());
        when(readPort.findEventEffectByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveEventEffect(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idEvent", 2);
        data.put("statistics", "HP");
        data.put("value", 5);
        data.put("target", "ALL");
        data.put("traitsToAdd", "T1");
        data.put("traitsToRemove", "T2");
        data.put("targetClass", 3);
        data.put("idItemTarget", 4);
        data.put("itemAction", "DROP");
        assertNotNull(service.updateEntity("s", "event-effects", "u", data));
    }

    @Test
    void updateEntity_choices_found() {
        setupStory();
        ChoiceEntity e = base(new ChoiceEntity());
        when(readPort.findChoiceByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveChoice(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idEvent", 2);
        data.put("idLocation", 3);
        data.put("priority", 1);
        data.put("idTextNarrative", 4);
        data.put("idEventTorun", 5);
        data.put("limitSad", 1);
        data.put("limitDex", 2);
        data.put("limitInt", 3);
        data.put("limitCos", 4);
        data.put("otherwiseFlag", 0);
        data.put("isProgress", 1);
        data.put("logicOperator", "OR");
        assertNotNull(service.updateEntity("s", "choices", "u", data));
    }

    @Test
    void updateEntity_choiceConditions_found() {
        setupStory();
        ChoiceConditionEntity e = base(new ChoiceConditionEntity());
        when(readPort.findChoiceConditionByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveChoiceCondition(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idChoices", 2);
        data.put("type", "T");
        data.put("key", "k");
        data.put("value", "v");
        data.put("operator", "GT");
        assertNotNull(service.updateEntity("s", "choice-conditions", "u", data));
    }

    @Test
    void updateEntity_choiceEffects_found() {
        setupStory();
        ChoiceEffectEntity e = base(new ChoiceEffectEntity());
        when(readPort.findChoiceEffectByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveChoiceEffect(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idChoices", 2);
        data.put("idScelta", 3);
        data.put("flagGroup", 0);
        data.put("statistics", "MP");
        data.put("value", 3);
        data.put("idText", 4);
        data.put("key", "k");
        data.put("valueToAdd", "x");
        data.put("valueToRemove", "y");
        assertNotNull(service.updateEntity("s", "choice-effects", "u", data));
    }

    @Test
    void updateEntity_items_found() {
        setupStory();
        ItemEntity e = base(new ItemEntity());
        when(readPort.findItemByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveItem(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("weight", 2);
        data.put("isConsumabile", 1);
        data.put("idClassPermitted", 3);
        data.put("idClassProhibited", 4);
        assertNotNull(service.updateEntity("s", "items", "u", data));
    }

    @Test
    void updateEntity_itemEffects_found() {
        setupStory();
        ItemEffectEntity e = base(new ItemEffectEntity());
        when(readPort.findItemEffectByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveItemEffect(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idItem", 2);
        data.put("effectCode", "C");
        data.put("effectValue", 5);
        assertNotNull(service.updateEntity("s", "item-effects", "u", data));
    }

    @Test
    void updateEntity_weatherRules_found() {
        setupStory();
        WeatherRuleEntity e = base(new WeatherRuleEntity());
        when(readPort.findWeatherRuleByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveWeatherRule(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("probability", 30);
        data.put("costMoveSafeLocation", 1);
        data.put("costMoveNotSafeLocation", 2);
        data.put("conditionKey", "k");
        data.put("conditionKeyValue", "v");
        data.put("timeFrom", 6);
        data.put("timeTo", 22);
        data.put("idText", 3);
        data.put("active", 1);
        data.put("priority", 2);
        data.put("deltaEnergy", -2);
        data.put("idEvent", 7);
        assertNotNull(service.updateEntity("s", "weather-rules", "u", data));
    }

    @Test
    void updateEntity_globalRandomEvents_found() {
        setupStory();
        GlobalRandomEventEntity e = base(new GlobalRandomEventEntity());
        when(readPort.findGlobalRandomEventByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveGlobalRandomEvent(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("conditionKey", "k");
        data.put("conditionValue", "v");
        data.put("probability", 5);
        data.put("idText", 2);
        data.put("idEvent", 3);
        assertNotNull(service.updateEntity("s", "global-random-events", "u", data));
    }

    @Test
    void updateEntity_characterTemplates_found() {
        setupStory();
        CharacterTemplateEntity e = base(new CharacterTemplateEntity());
        when(readPort.findCharacterTemplateByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveCharacterTemplate(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("lifeMax", 100);
        data.put("energyMax", 50);
        data.put("sadMax", 20);
        data.put("dexterityStart", 10);
        data.put("intelligenceStart", 8);
        data.put("constitutionStart", 12);
        assertNotNull(service.updateEntity("s", "character-templates", "u", data));
    }

    @Test
    void updateEntity_classes_found() {
        setupStory();
        ClassEntity e = base(new ClassEntity());
        when(readPort.findClassByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveClass(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("weightMax", 15);
        data.put("dexterityBase", 4);
        data.put("intelligenceBase", 5);
        data.put("constitutionBase", 6);
        assertNotNull(service.updateEntity("s", "classes", "u", data));
    }

    @Test
    void updateEntity_classBonuses_found() {
        setupStory();
        ClassBonusEntity e = base(new ClassBonusEntity());
        when(readPort.findClassBonusByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveClassBonus(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idClass", 2);
        data.put("statistic", "DEX");
        data.put("value", 2);
        assertNotNull(service.updateEntity("s", "class-bonuses", "u", data));
    }

    @Test
    void updateEntity_traits_found() {
        setupStory();
        TraitEntity e = base(new TraitEntity());
        when(readPort.findTraitByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveTrait(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("idClassPermitted", 2);
        data.put("idClassProhibited", 3);
        data.put("costPositive", 4);
        data.put("costNegative", 2);
        assertNotNull(service.updateEntity("s", "traits", "u", data));
    }

    @Test
    void updateEntity_texts_found() {
        setupStory();
        TextEntity e = base(new TextEntity());
        when(readPort.findTextByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveText(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idText", 10);
        data.put("lang", "en");
        data.put("shortText", "Hi");
        data.put("longText", "Hello world");
        data.put("idTextCopyright", 20);
        data.put("linkCopyright", "http://c");
        data.put("idCreator", 5);
        assertNotNull(service.updateEntity("s", "texts", "u", data));
    }

    @Test
    void updateEntity_cards_found() {
        setupStory();
        CardEntity e = base(new CardEntity());
        when(readPort.findCardByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveCard(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextTitle", 1);
        data.put("idTextDescription", 2);
        data.put("idTextCopyright", 3);
        data.put("linkCopyright", "http://c");
        data.put("idCreator", 4);
        data.put("urlImmage", "http://img");
        data.put("alternativeImage", "alt");
        data.put("awesomeIcon", "icon");
        data.put("styleMain", "m");
        data.put("styleDetail", "d");
        assertNotNull(service.updateEntity("s", "cards", "u", data));
    }

    @Test
    void updateEntity_creators_found() {
        setupStory();
        CreatorEntity e = base(new CreatorEntity());
        when(readPort.findCreatorByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveCreator(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idText", 1);
        data.put("link", "http://l");
        data.put("url", "http://u");
        data.put("urlImage", "http://i");
        data.put("urlEmote", "http://e");
        data.put("urlInstagram", "http://ig");
        assertNotNull(service.updateEntity("s", "creators", "u", data));
    }

    @Test
    void updateEntity_missions_found() {
        setupStory();
        MissionEntity e = base(new MissionEntity());
        when(readPort.findMissionByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveMission(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("conditionKey", "k");
        data.put("conditionValueFrom", "0");
        data.put("conditionValueTo", "5");
        data.put("idEventCompleted", 7);
        assertNotNull(service.updateEntity("s", "missions", "u", data));
    }

    @Test
    void updateEntity_missionSteps_found() {
        setupStory();
        MissionStepEntity e = base(new MissionStepEntity());
        when(readPort.findMissionStepByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(e));
        when(persistencePort.saveMissionStep(any())).thenReturn(e);
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", 1);
        data.put("conditionKey", "k");
        data.put("conditionValueFrom", "0");
        data.put("conditionValueTo", "5");
        data.put("idEventCompleted", 7);
        data.put("idMission", 3);
        data.put("step", 2);
        assertNotNull(service.updateEntity("s", "mission-steps", "u", data));
    }

    // =========================================================================
    // deleteEntity – tutti i 22 tipi + guard clauses
    // =========================================================================

    @Test
    void deleteEntity_blankArgs_returnsFalse() {
        assertFalse(service.deleteEntity(null, "t", "u"));
        assertFalse(service.deleteEntity("s", null, "u"));
        assertFalse(service.deleteEntity("s", "t", null));
    }

    @Test
    void deleteEntity_storyNotFound_returnsFalse() {
        when(readPort.findStoryByUuid("x")).thenReturn(Optional.empty());
        assertFalse(service.deleteEntity("x", "locations", "u"));
    }

    @Test
    void deleteEntity_unknown_returnsFalse() {
        setupStory();
        assertFalse(service.deleteEntity("s", "unknown", "u"));
    }

    private void stubDelete(String type, String mockType) {
        // just needs entity found → true path
    }

    @Test
    void deleteEntity_difficulties_found() {
        setupStory();
        when(readPort.findDifficultyByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new StoryDifficultyEntity())));
        assertTrue(service.deleteEntity("s", "difficulties", "u"));
        verify(persistencePort).deleteDifficultyByUuid("u");
    }

    @Test
    void deleteEntity_difficulties_notFound() {
        setupStory();
        when(readPort.findDifficultyByStoryIdAndUuid(1L, "u")).thenReturn(Optional.empty());
        assertFalse(service.deleteEntity("s", "difficulties", "u"));
    }

    @Test
    void deleteEntity_locations_found() {
        setupStory();
        when(readPort.findLocationByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new LocationEntity())));
        assertTrue(service.deleteEntity("s", "locations", "u"));
        verify(persistencePort).deleteLocationByUuid("u");
    }

    @Test
    void deleteEntity_locationNeighbors_found() {
        setupStory();
        when(readPort.findLocationNeighborByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new LocationNeighborEntity())));
        assertTrue(service.deleteEntity("s", "location-neighbors", "u"));
        verify(persistencePort).deleteLocationNeighborByUuid("u");
    }

    @Test
    void deleteEntity_keys_found() {
        setupStory();
        when(readPort.findKeyByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new KeyEntity())));
        assertTrue(service.deleteEntity("s", "keys", "u"));
        verify(persistencePort).deleteKeyByUuid("u");
    }

    @Test
    void deleteEntity_events_found() {
        setupStory();
        when(readPort.findEventByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new EventEntity())));
        assertTrue(service.deleteEntity("s", "events", "u"));
        verify(persistencePort).deleteEventByUuid("u");
    }

    @Test
    void deleteEntity_eventEffects_found() {
        setupStory();
        when(readPort.findEventEffectByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new EventEffectEntity())));
        assertTrue(service.deleteEntity("s", "event-effects", "u"));
        verify(persistencePort).deleteEventEffectByUuid("u");
    }

    @Test
    void deleteEntity_choices_found() {
        setupStory();
        when(readPort.findChoiceByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ChoiceEntity())));
        assertTrue(service.deleteEntity("s", "choices", "u"));
        verify(persistencePort).deleteChoiceByUuid("u");
    }

    @Test
    void deleteEntity_choiceConditions_found() {
        setupStory();
        when(readPort.findChoiceConditionByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new ChoiceConditionEntity())));
        assertTrue(service.deleteEntity("s", "choice-conditions", "u"));
        verify(persistencePort).deleteChoiceConditionByUuid("u");
    }

    @Test
    void deleteEntity_choiceEffects_found() {
        setupStory();
        when(readPort.findChoiceEffectByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new ChoiceEffectEntity())));
        assertTrue(service.deleteEntity("s", "choice-effects", "u"));
        verify(persistencePort).deleteChoiceEffectByUuid("u");
    }

    @Test
    void deleteEntity_items_found() {
        setupStory();
        when(readPort.findItemByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ItemEntity())));
        assertTrue(service.deleteEntity("s", "items", "u"));
        verify(persistencePort).deleteItemByUuid("u");
    }

    @Test
    void deleteEntity_itemEffects_found() {
        setupStory();
        when(readPort.findItemEffectByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ItemEffectEntity())));
        assertTrue(service.deleteEntity("s", "item-effects", "u"));
        verify(persistencePort).deleteItemEffectByUuid("u");
    }

    @Test
    void deleteEntity_weatherRules_found() {
        setupStory();
        when(readPort.findWeatherRuleByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new WeatherRuleEntity())));
        assertTrue(service.deleteEntity("s", "weather-rules", "u"));
        verify(persistencePort).deleteWeatherRuleByUuid("u");
    }

    @Test
    void deleteEntity_globalRandomEvents_found() {
        setupStory();
        when(readPort.findGlobalRandomEventByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new GlobalRandomEventEntity())));
        assertTrue(service.deleteEntity("s", "global-random-events", "u"));
        verify(persistencePort).deleteGlobalRandomEventByUuid("u");
    }

    @Test
    void deleteEntity_characterTemplates_found() {
        setupStory();
        when(readPort.findCharacterTemplateByStoryIdAndUuid(1L, "u"))
                .thenReturn(Optional.of(base(new CharacterTemplateEntity())));
        assertTrue(service.deleteEntity("s", "character-templates", "u"));
        verify(persistencePort).deleteCharacterTemplateByUuid("u");
    }

    @Test
    void deleteEntity_classes_found() {
        setupStory();
        when(readPort.findClassByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ClassEntity())));
        assertTrue(service.deleteEntity("s", "classes", "u"));
        verify(persistencePort).deleteClassByUuid("u");
    }

    @Test
    void deleteEntity_classBonuses_found() {
        setupStory();
        when(readPort.findClassBonusByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new ClassBonusEntity())));
        assertTrue(service.deleteEntity("s", "class-bonuses", "u"));
        verify(persistencePort).deleteClassBonusByUuid("u");
    }

    @Test
    void deleteEntity_traits_found() {
        setupStory();
        when(readPort.findTraitByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new TraitEntity())));
        assertTrue(service.deleteEntity("s", "traits", "u"));
        verify(persistencePort).deleteTraitByUuid("u");
    }

    @Test
    void deleteEntity_texts_found() {
        setupStory();
        when(readPort.findTextByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new TextEntity())));
        assertTrue(service.deleteEntity("s", "texts", "u"));
        verify(persistencePort).deleteTextByUuid("u");
    }

    @Test
    void deleteEntity_cards_found() {
        setupStory();
        when(readPort.findCardByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new CardEntity())));
        assertTrue(service.deleteEntity("s", "cards", "u"));
        verify(persistencePort).deleteCardByUuid("u");
    }

    @Test
    void deleteEntity_creators_found() {
        setupStory();
        when(readPort.findCreatorByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new CreatorEntity())));
        assertTrue(service.deleteEntity("s", "creators", "u"));
        verify(persistencePort).deleteCreatorByUuid("u");
    }

    @Test
    void deleteEntity_missions_found() {
        setupStory();
        when(readPort.findMissionByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new MissionEntity())));
        assertTrue(service.deleteEntity("s", "missions", "u"));
        verify(persistencePort).deleteMissionByUuid("u");
    }

    @Test
    void deleteEntity_missionSteps_found() {
        setupStory();
        when(readPort.findMissionStepByStoryIdAndUuid(1L, "u")).thenReturn(Optional.of(base(new MissionStepEntity())));
        assertTrue(service.deleteEntity("s", "mission-steps", "u"));
        verify(persistencePort).deleteMissionStepByUuid("u");
    }

    // =========================================================================
    // intVal – branch: String valido, String non valido, null
    // =========================================================================

    @Test
    void intVal_stringValue_parsed() {
        // Esercitato indirettamente tramite createEntity con valori String
        setupStory();
        when(persistencePort.saveKey(any())).thenReturn(base(new KeyEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", "42"); // String → intVal branch String
        data.put("priority", "not-a-number"); // String non valido → null branch
        data.put("name", "k");
        assertNotNull(service.createEntity("s", "keys", data));
    }

    @Test
    void intVal_nullValue_returnsNull() {
        // value null per chiave presente → terzo branch di intVal
        setupStory();
        when(persistencePort.saveKey(any())).thenReturn(base(new KeyEntity()));
        Map<String, Object> data = new HashMap<>();
        data.put("idTextName", null); // null value → null
        data.put("name", "k");
        assertNotNull(service.createEntity("s", "keys", data));
    }
}