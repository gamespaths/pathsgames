package games.paths.core.service.story;

import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.story.StoryValidationReport;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.port.story.StoryValidatorPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.AdditionalAnswers.returnsFirstArg;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * Field-level coverage of StoryCrudService: every {@code apply*Fields} mapper has one
 * {@code if (d.containsKey(...))} guard per column, and this suite feeds each entity
 * type a payload carrying ALL of its columns, so the "key present" side of every guard
 * is exercised. The assertion is a round trip — what goes into {@code createEntity} must
 * come back out of the entity's {@code toMap} unchanged.
 *
 * <p>Also covers the Step 22 validator hook, which only runs when a validator is wired.</p>
 */
class StoryCrudServiceFieldMappingTest {

    private StoryReadPort readPort;
    private StoryPersistencePort persistencePort;
    private StoryCrudService service;

    @BeforeEach
    void setUp() {
        readPort = mock(StoryReadPort.class);
        // Every saveXxx hands back the entity it was given, so createEntity maps it straight back.
        persistencePort = mock(StoryPersistencePort.class, returnsFirstArg());
        service = new StoryCrudService(readPort, persistencePort);
        StoryEntity story = new StoryEntity();
        story.setId(1L);
        story.setUuid("story-uuid");
        when(readPort.findStoryByUuid("story-uuid")).thenReturn(Optional.of(story));
    }

    /** Builds the request payload from alternating key/value pairs. */
    private static Map<String, Object> data(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    private void assertEveryFieldRoundTrips(String entityType, Map<String, Object> payload) {
        Map<String, Object> result = service.createEntity("story-uuid", entityType, payload);
        assertNotNull(result, entityType + " was not created");
        assertEquals(1L, result.get("idStory"));
        payload.forEach((k, v) -> assertEquals(v, result.get(k), entityType + "." + k));
    }

    /** The 22 entity types {@code createByType} dispatches on. */
    private static final List<String> ENTITY_TYPES = List.of(
            "difficulties", "locations", "location-neighbors", "keys", "events", "event-effects",
            "choices", "choice-conditions", "choice-effects", "items", "item-effects", "weather-rules",
            "global-random-events", "character-templates", "classes", "class-bonuses", "traits",
            "creators", "cards", "texts", "missions", "mission-steps");

    /** Keys {@code toMap} always fills in, whatever the payload carried. */
    private static final Set<String> ALWAYS_PRESENT = Set.of("id", "uuid", "idStory",
            "tsInsert", "tsUpdate", "idTextName");

    @Test
    void leavesEveryColumnThePayloadOmitsUntouched() {
        for (String type : ENTITY_TYPES) {
            Map<String, Object> result = service.createEntity("story-uuid", type, data("idTextName", 7));

            assertNotNull(result, type + " was not created");
            assertEquals(7, result.get("idTextName"), type + ".idTextName");
            result.forEach((k, v) -> {
                if (!ALWAYS_PRESENT.contains(k)) {
                    assertNull(v, type + "." + k + " should have stayed unset");
                }
            });
        }
    }

    @Test
    void createsADifficultyWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("difficulties", data(
                "idTextName", 11, "idTextDescription", 12, "idCard", 13, "expCost", 14, "maxWeight", 15,
                "minCharacter", 16, "maxCharacter", 17, "costHelpComa", 18, "costMaxCharacteristics", 19,
                "numberMaxFreeAction", 20, "traitCostPositiveBudget", 21, "traitCostNegativeBudget", 22,
                "life", 23, "energy", 24, "sad", 25, "dexterity", 26, "intelligence", 27, "constitution", 28,
                "weight", 29));
    }

    @Test
    void createsALocationWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("locations", data(
                "idTextName", 30, "idTextDescription", 31, "idCard", 32, "idTextNarrative", 33, "idImage", 34,
                "isSafe", 35, "costEnergyEnter", 36, "counterTime", 37, "idEventIfCounterZero", 38,
                "secureParam", 39, "idEventIfCharacterStartTime", 40, "idEventIfCharacterEnterEmptyLocation", 41,
                "idEventIfFirstTime", 42, "idEventNotFirstTime", 43, "priorityAutomaticEvent", 44, "idAudio", 45,
                "maxCharacters", 46));
    }

    @Test
    void createsALocationNeighborWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("location-neighbors", data(
                "idTextName", 47, "idTextDescription", 48, "idCard", 49, "idLocationFrom", 50, "idLocationTo", 51,
                "direction", "direction-v", "flagBack", 52, "conditionRegistryKey", "conditionRegistryKey-v",
                "conditionRegistryValue", "conditionRegistryValue-v", "energyCost", 53, "idTextGo", 54,
                "idTextBack", 55, "idCardBack", 56));
    }

    @Test
    void createsAKeyWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("keys", data(
                "idTextName", 57, "idTextDescription", 58, "idCard", 59, "name", "name-v", "value", "value-v",
                "group", "group-v", "priority", 60, "visibility", "visibility-v"));
    }

    @Test
    void createsAnEventWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("events", data(
                "idTextName", 61, "idTextDescription", 62, "idCard", 63, "idSpecificLocation", 64,
                "type", "type-v", "costEnery", 65, "flagEndTime", 66, "idWeather", 67, "idEventNext", 68,
                "coinCost", 69, "registryKeyCondition", "registryKeyCondition-v",
                "registryValueCondition", "registryValueCondition-v", "idClassCondition", 70,
                "idItemCondition", 71));
    }

    @Test
    void createsAnEventEffectWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("event-effects", data(
                "idTextName", 72, "idTextDescription", 73, "idCard", 74, "idEvent", 75,
                "statistics", "statistics-v", "value", 76, "target", "target-v", "traitsToAdd", "traitsToAdd-v",
                "traitsToRemove", "traitsToRemove-v", "targetClass", 77, "idItemTarget", 78,
                "itemAction", "itemAction-v", "idWeather", 79, "keyToAdd", "keyToAdd-v",
                "keyValueToAdd", "keyValueToAdd-v", "characteristicToAdd", "characteristicToAdd-v",
                "characteristicToRemove", "characteristicToRemove-v", "idLocation", 80));
    }

    @Test
    void createsAChoiceWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("choices", data(
                "idTextName", 81, "idTextDescription", 82, "idCard", 83, "idEvent", 84, "idLocation", 85,
                "priority", 86, "idTextNarrative", 87, "idEventTorun", 88, "limitSad", 89, "limitDex", 90,
                "limitInt", 91, "limitCos", 92, "otherwiseFlag", 93, "isProgress", 94,
                "logicOperator", "logicOperator-v"));
    }

    @Test
    void createsAChoiceConditionWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("choice-conditions", data(
                "idTextName", 95, "idTextDescription", 96, "idCard", 97, "idChoices", 98, "type", "type-v",
                "key", "key-v", "value", "value-v", "operator", "operator-v"));
    }

    @Test
    void createsAChoiceEffectWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("choice-effects", data(
                "idTextName", 99, "idTextDescription", 100, "idCard", 101, "idChoices", 102, "idScelta", 103,
                "flagGroup", 104, "statistics", "statistics-v", "value", 105, "idText", 106, "key", "key-v",
                "valueToAdd", "valueToAdd-v", "valueToRemove", "valueToRemove-v", "idEvent", 107,
                "idLocation", 108, "idWeather", 109, "idItemTarget", 110, "itemAction", "itemAction-v"));
    }

    @Test
    void createsAnItemWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("items", data(
                "idTextName", 111, "idTextDescription", 112, "idCard", 113, "weight", 114, "isConsumabile", 115,
                "flagShowEffects", 1, "idClassPermitted", 116, "idClassProhibited", 117));
    }

    @Test
    void createsAnItemEffectWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("item-effects", data(
                "idTextName", 118, "idTextDescription", 119, "idCard", 120, "idItem", 121,
                "effectCode", "effectCode-v", "effectValue", 122));
    }

    @Test
    void createsAWeatherRuleWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("weather-rules", data(
                "idTextName", 123, "idTextDescription", 124, "idCard", 125, "probability", 126,
                "costMoveSafeLocation", 127, "costMoveNotSafeLocation", 128, "conditionKey", "conditionKey-v",
                "conditionKeyValue", "conditionKeyValue-v", "timeFrom", 129, "timeTo", 130, "idText", 131,
                "active", 132, "priority", 133, "deltaEnergy", 134, "idEvent", 135));
    }

    @Test
    void createsAGlobalRandomEventWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("global-random-events", data(
                "idTextName", 136, "idTextDescription", 137, "idCard", 138, "conditionKey", "conditionKey-v",
                "conditionValue", "conditionValue-v", "probability", 139, "idText", 140, "idEvent", 141));
    }

    @Test
    void createsACharacterTemplateWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("character-templates", data(
                "idTextName", 142, "idTextDescription", 143, "idCard", 144, "lifeMax", 145, "energyMax", 146,
                "sadMax", 147, "dexterityStart", 148, "intelligenceStart", 149, "constitutionStart", 150,
                "idClassPermitted", 151, "idClassProhibited", 152));
    }

    @Test
    void createsAClassWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("classes", data(
                "idTextName", 153, "idTextDescription", 154, "idCard", 155, "weightMax", 156,
                "dexterityBase", 157, "intelligenceBase", 158, "constitutionBase", 159));
    }

    @Test
    void createsAClassBonusWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("class-bonuses", data(
                "idTextName", 160, "idTextDescription", 161, "idCard", 162, "idClass", 163,
                "statistic", "statistic-v", "value", 164));
    }

    @Test
    void createsATraitWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("traits", data(
                "idTextName", 165, "idTextDescription", 166, "idCard", 167, "idClassPermitted", 168,
                "idClassProhibited", 169, "costPositive", 170, "costNegative", 171, "life", 172, "energy", 173,
                "sad", 174, "dexterity", 175, "intelligence", 176, "constitution", 177, "weight", 178));
    }

    @Test
    void createsACreatorWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("creators", data(
                "idTextName", 179, "idTextDescription", 180, "idCard", 181, "idText", 182, "link", "link-v",
                "url", "url-v", "urlImage", "urlImage-v", "urlEmote", "urlEmote-v",
                "urlInstagram", "urlInstagram-v"));
    }

    @Test
    void createsACardWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("cards", data(
                "idTextName", 183, "idTextDescription", 184, "idCard", 185, "cardType", "cardType-v",
                "idTextTitle", 186, "idTextCopyright", 187, "linkCopyright", "linkCopyright-v", "idCreator", 188,
                "urlImage", "urlImage-v", "alternativeImage", "alternativeImage-v",
                "awesomeIcon", "awesomeIcon-v", "styleMain", "styleMain-v", "styleDetail", "styleDetail-v",
                "styleImageLittle", "styleImageLittle-v", "styleImageMedium", "styleImageMedium-v",
                "styleImageLarge", "styleImageLarge-v"));
    }

    @Test
    void createsATextWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("texts", data(
                "idTextName", 189, "idTextDescription", 190, "idCard", 191, "idText", 192, "lang", "lang-v",
                "shortText", "shortText-v", "longText", "longText-v", "idTextCopyright", 193,
                "linkCopyright", "linkCopyright-v", "idCreator", 194));
    }

    @Test
    void createsAMissionWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("missions", data(
                "idTextName", 195, "idTextDescription", 196, "idCard", 197, "conditionKey", "conditionKey-v",
                "conditionValueFrom", "conditionValueFrom-v", "conditionValueTo", "conditionValueTo-v",
                "idEventCompleted", 198));
    }

    @Test
    void createsAMissionStepWithEveryFieldMapped() {
        assertEveryFieldRoundTrips("mission-steps", data(
                "idTextName", 199, "idTextDescription", 200, "idCard", 201, "conditionKey", "conditionKey-v",
                "conditionValueFrom", "conditionValueFrom-v", "conditionValueTo", "conditionValueTo-v",
                "idEventCompleted", 202, "idMission", 203, "step", 204));
    }

    // === The story row itself (applyStoryFields) ===

    @Test
    void createsAStoryWithEveryFieldMapped() {
        Map<String, Object> payload = data(
                "author", "author-v", "versionMin", "1.0", "versionMax", "2.0", "category", "category-v",
                "group", "group-v", "visibility", "PUBLIC", "priority", 1, "peghi", 2, "idTextTitle", 3,
                "idLocationStart", 4, "idImage", 5, "idLocationAllPlayerComa", 6, "idEventAllPlayerComa", 7,
                "idTextClockSingular", 8, "idTextClockPlural", 9, "idEventEndGame", 10,
                "idTextCopyright", 11, "linkCopyright", "link-v", "idCreator", 12);

        Map<String, Object> result = service.createStory(payload);

        assertNotNull(result);
        payload.forEach((k, v) -> assertEquals(v, result.get(k), "story." + k));
    }

    @Test
    void updatesAStoryWithEveryFieldMapped() {
        Map<String, Object> payload = data(
                "author", "author-v", "versionMin", "1.0", "versionMax", "2.0", "category", "category-v",
                "group", "group-v", "visibility", "PRIVATE", "priority", 1, "peghi", 2, "idTextTitle", 3,
                "idLocationStart", 4, "idImage", 5, "idLocationAllPlayerComa", 6, "idEventAllPlayerComa", 7,
                "idTextClockSingular", 8, "idTextClockPlural", 9, "idEventEndGame", 10,
                "idTextCopyright", 11, "linkCopyright", "link-v", "idCreator", 12);

        Map<String, Object> result = service.updateStory("story-uuid", payload);

        assertNotNull(result);
        payload.forEach((k, v) -> assertEquals(v, result.get(k), "story." + k));
    }

    @Test
    void leavesEveryStoryColumnThePayloadOmitsUntouched() {
        Map<String, Object> result = service.createStory(data("priority", 5));

        assertNotNull(result);
        assertEquals(5, result.get("priority"));
        assertNull(result.get("author"));
        assertNull(result.get("visibility"));
        assertNull(result.get("idEventEndGame"));
    }

    // === intVal coercion ===

    @Test
    void acceptsNumericStringsAndRejectsEverythingElseAsNull() {
        Map<String, Object> result = service.createEntity("story-uuid", "locations",
                data("idTextName", "42", "idImage", "not-a-number"));

        assertNotNull(result);
        assertEquals(42, result.get("idTextName"));   // parsed
        assertNull(result.get("idImage"));            // unparseable → null
    }

    @Test
    void acceptsABooleanForAFlagColumn() {
        // v0.35.0 — the admin form sends every checkbox as a JSON boolean and every flag
        // column is an INTEGER. Until this version a ticked box read as null, so the field
        // was dropped instead of written: isSafe, isConsumabile and flagShowEffects alike.
        Map<String, Object> on = service.createEntity("story-uuid", "locations",
                data("idTextName", 1, "isSafe", true));
        Map<String, Object> off = service.createEntity("story-uuid", "locations",
                data("idTextName", 1, "isSafe", false));

        assertEquals(1, on.get("isSafe"));
        assertEquals(0, off.get("isSafe"));
    }

    // === Step 22 validator hook ===

    @Test
    void createRunsTheValidatorAndThrowsOnAnInvalidPayload() {
        StoryValidatorPort validator = mock(StoryValidatorPort.class);
        StoryValidationReport report = new StoryValidationReport();
        report.add("rule", "locations", "1", "idTextName", "missing");
        when(validator.validateEntity(eq("locations"), any())).thenReturn(report);
        service = new StoryCrudService(readPort, persistencePort, validator);

        assertThrows(StoryValidatorPort.StoryValidationException.class,
                () -> service.createEntity("story-uuid", "locations", data("idTextName", 1)));
        verify(persistencePort, never()).saveLocation(any());
    }

    @Test
    void createSavesWhenTheValidatorAcceptsThePayload() {
        StoryValidatorPort validator = mock(StoryValidatorPort.class);
        when(validator.validateEntity(anyString(), any())).thenReturn(new StoryValidationReport());
        service = new StoryCrudService(readPort, persistencePort, validator);

        assertNotNull(service.createEntity("story-uuid", "locations", data("idTextName", 1)));
        verify(persistencePort).saveLocation(any());
    }

    @Test
    void updateRunsTheValidatorAndThrowsOnAnInvalidPayload() {
        StoryValidatorPort validator = mock(StoryValidatorPort.class);
        StoryValidationReport report = new StoryValidationReport();
        report.add("rule", "locations", "1", "idTextName", "missing");
        when(validator.validateEntity(eq("locations"), any())).thenReturn(report);
        service = new StoryCrudService(readPort, persistencePort, validator);

        assertThrows(StoryValidatorPort.StoryValidationException.class,
                () -> service.updateEntity("story-uuid", "locations", "ent-uuid", data("idTextName", 1)));
    }
}
