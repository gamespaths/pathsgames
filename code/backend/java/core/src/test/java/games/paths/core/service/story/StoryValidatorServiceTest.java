package games.paths.core.service.story;

import games.paths.core.entity.story.*;
import games.paths.core.model.story.StoryValidationReport;
import games.paths.core.port.story.StoryReadPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.lenient;

/**
 * Unit tests for {@link StoryValidatorService} (Step 22).
 *
 * <p>Reference-integrity rules are exercised through {@link StoryValidatorService#validateImportData(Map)}
 * (no DB needed). A representative DB-backed case covers {@link StoryValidatorService#validateStory(Long)}.</p>
 */
@ExtendWith(MockitoExtension.class)
class StoryValidatorServiceTest {

    @Mock
    private StoryReadPort readPort;

    private StoryValidatorService validator() {
        return new StoryValidatorService(readPort);
    }

    // ---- builders -------------------------------------------------------

    private static Map<String, Object> entity(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            m.put((String) kv[i], kv[i + 1]);
        }
        return m;
    }

    @SafeVarargs
    private static List<Map<String, Object>> rows(Map<String, Object>... rows) {
        return new ArrayList<>(Arrays.asList(rows));
    }

    /** Minimal valid story: one location, one event, one item, one class. */
    private static Map<String, Object> validStory() {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("uuid", "story-valid");
        s.put("idLocationStart", 1);
        s.put("locations", rows(entity("id", 1), entity("id", 2)));
        s.put("events", rows(entity("id", 1), entity("id", 2, "idEventNext", 1)));
        s.put("items", rows(entity("id", 1)));
        s.put("classes", rows(entity("id", 1)));
        s.put("keys", rows(entity("name", "CHAPTER", "value", "1")));
        s.put("choices", rows(entity("id", 1, "idEvent", 1, "otherwiseFlag", 1)));
        s.put("locationNeighbors", rows(entity("id", 1, "idLocationFrom", 1, "idLocationTo", 2, "direction", "N")));
        return s;
    }

    @Nested
    @DisplayName("Valid stories")
    class Valid {
        @Test
        @DisplayName("a fully-consistent story produces no errors")
        void validStoryPasses() {
            StoryValidationReport r = validator().validateImportData(validStory());
            assertTrue(r.isValid(), () -> "expected valid, got: " + r.summary());
        }

        @Test
        @DisplayName("null / empty import data is reported")
        void emptyReported() {
            assertFalse(validator().validateImportData(null).isValid());
            assertFalse(validator().validateImportData(Map.of()).isValid());
        }
    }

    @Nested
    @DisplayName("R1 story-level FK references")
    class StoryFks {
        @Test
        void danglingLocationStart() {
            Map<String, Object> s = validStory();
            s.put("idLocationStart", 99);
            StoryValidationReport r = validator().validateImportData(s);
            assertFalse(r.isValid());
            assertTrue(r.getErrors().stream().anyMatch(e -> "idLocationStart".equals(e.field())));
        }

        @Test
        void danglingEventEndGame() {
            Map<String, Object> s = validStory();
            s.put("idEventEndGame", 42);
            assertFalse(validator().validateImportData(s).isValid());
        }

        @Test
        void zeroReferenceMeansNone() {
            Map<String, Object> s = validStory();
            s.put("idLocationAllPlayerComa", 0);
            s.put("idEventAllPlayerComa", -1);
            assertTrue(validator().validateImportData(s).isValid());
        }
    }

    @Nested
    @DisplayName("Event-effect references (v0.29.3 forced movement)")
    class EventEffectRefs {
        @Test
        void danglingEffectLocation() {
            Map<String, Object> s = validStory();
            s.put("eventEffects", rows(entity("id", 1, "idEvent", 1, "idLocation", 77)));
            StoryValidationReport r = validator().validateImportData(s);
            assertFalse(r.isValid());
            assertTrue(r.getErrors().stream().anyMatch(e -> "idLocation".equals(e.field())));
        }

        @Test
        void effectMovingToARealLocationPasses() {
            Map<String, Object> s = validStory();
            s.put("eventEffects", rows(entity("id", 1, "idEvent", 1, "idLocation", 2)));
            assertTrue(validator().validateImportData(s).isValid());
        }
    }

    @Nested
    @DisplayName("Choice-effect references (v0.32.0 resolution targets)")
    class ChoiceEffectRefs {

        /** The story of {@link #validStory()} plus a weather rule to point at. */
        private Map<String, Object> storyWithWeather() {
            Map<String, Object> s = validStory();
            s.put("weatherRules", rows(entity("id", 1)));
            return s;
        }

        @Test
        @DisplayName("every new target is checked against the story it names")
        void danglingTargetsAreReported() {
            Map<String, String> danglers = Map.of(
                    "idEvent", "idEvent",
                    "idLocation", "idLocation",
                    "idWeather", "idWeather",
                    "idItemTarget", "idItemTarget");
            for (Map.Entry<String, String> dangler : danglers.entrySet()) {
                Map<String, Object> s = storyWithWeather();
                s.put("choiceEffects",
                        rows(entity("id", 1, "idChoices", 1, dangler.getKey(), 99)));
                StoryValidationReport r = validator().validateImportData(s);
                assertFalse(r.isValid(), dangler.getKey() + " should not validate");
                assertTrue(r.getErrors().stream().anyMatch(e -> dangler.getValue().equals(e.field())),
                        () -> dangler.getKey() + " missing from: " + r.summary());
            }
        }

        @Test
        @DisplayName("targets that all exist validate clean")
        void realTargetsPass() {
            Map<String, Object> s = storyWithWeather();
            s.put("choiceEffects", rows(entity("id", 1, "idChoices", 1,
                    "idEvent", 2, "idLocation", 2, "idWeather", 1,
                    "idItemTarget", 1, "itemAction", "ADD")));
            StoryValidationReport r = validator().validateImportData(s);
            assertTrue(r.isValid(), () -> "expected valid, got: " + r.summary());
        }
    }

    @Nested
    @DisplayName("R2 location neighbors")
    class Neighbors {
        @Test
        void neighborToMissingLocation() {
            Map<String, Object> s = validStory();
            s.put("locationNeighbors", rows(entity("id", 1, "idLocationFrom", 1, "idLocationTo", 77, "direction", "N")));
            assertFalse(validator().validateImportData(s).isValid());
        }

        @Test
        void selfLoopReported() {
            Map<String, Object> s = validStory();
            s.put("locationNeighbors", rows(entity("id", 1, "idLocationFrom", 1, "idLocationTo", 1, "direction", "N")));
            StoryValidationReport r = validator().validateImportData(s);
            assertTrue(r.getErrors().stream().anyMatch(e -> "R2_NEIGHBOR_SELF".equals(e.rule())));
        }

        @Test
        void blankDirectionReported() {
            Map<String, Object> s = validStory();
            s.put("locationNeighbors", rows(entity("id", 1, "idLocationFrom", 1, "idLocationTo", 2, "direction", "")));
            assertTrue(validator().validateImportData(s).getErrors().stream()
                    .anyMatch(e -> "R2_NEIGHBOR_DIR".equals(e.rule())));
        }

        @Test
        void duplicateDirectionReported() {
            Map<String, Object> s = validStory();
            s.put("locationNeighbors", rows(
                    entity("id", 1, "idLocationFrom", 1, "idLocationTo", 2, "direction", "N"),
                    entity("id", 2, "idLocationFrom", 1, "idLocationTo", 1, "direction", "N")));
            assertTrue(validator().validateImportData(s).getErrors().stream()
                    .anyMatch(e -> "R2_NEIGHBOR_DUP".equals(e.rule())));
        }
    }

    @Nested
    @DisplayName("R3 events")
    class Events {
        @Test
        void eventRefersMissingLocation() {
            Map<String, Object> s = validStory();
            s.put("events", rows(entity("id", 1, "idSpecificLocation", 50)));
            assertFalse(validator().validateImportData(s).isValid());
        }

        @Test
        void eventChainCycleDetected() {
            Map<String, Object> s = validStory();
            s.put("events", rows(
                    entity("id", 1, "idEventNext", 2),
                    entity("id", 2, "idEventNext", 1)));
            StoryValidationReport r = validator().validateImportData(s);
            assertTrue(r.getErrors().stream().anyMatch(e -> "R3_EVENT_CYCLE".equals(e.rule())),
                    () -> "expected cycle, got " + r.summary());
        }

        @Test
        void selfCycleDetected() {
            Map<String, Object> s = validStory();
            s.put("events", rows(entity("id", 1, "idEventNext", 1)));
            assertTrue(validator().validateImportData(s).getErrors().stream()
                    .anyMatch(e -> "R3_EVENT_CYCLE".equals(e.rule())));
        }

        @Test
        void longAcyclicChainPasses() {
            Map<String, Object> s = validStory();
            s.put("events", rows(
                    entity("id", 1, "idEventNext", 2),
                    entity("id", 2, "idEventNext", 3),
                    entity("id", 3)));
            assertTrue(validator().validateImportData(s).isValid());
        }
    }

    @Nested
    @DisplayName("R4 choices and conditions")
    class Choices {
        @Test
        void choiceWithoutOptionOrOtherwise() {
            Map<String, Object> s = validStory();
            s.put("choices", rows(entity("id", 1, "idEvent", 1, "otherwiseFlag", 0)));
            // no choiceEffects → no option, otherwise=0 → invalid
            StoryValidationReport r = validator().validateImportData(s);
            assertTrue(r.getErrors().stream().anyMatch(e -> "R4_CHOICE_EMPTY".equals(e.rule())));
        }

        @Test
        void choiceWithEffectPasses() {
            Map<String, Object> s = validStory();
            s.put("choices", rows(entity("id", 1, "idEvent", 1, "otherwiseFlag", 0)));
            s.put("choiceEffects", rows(entity("id", 1, "idChoices", 1)));
            assertTrue(validator().validateImportData(s).isValid());
        }

        @Test
        void choiceRefersMissingEvent() {
            Map<String, Object> s = validStory();
            s.put("choices", rows(entity("id", 1, "idEvent", 88, "otherwiseFlag", 1)));
            assertFalse(validator().validateImportData(s).isValid());
        }

        @Test
        void conditionWithUnknownKey() {
            Map<String, Object> s = validStory();
            s.put("choiceConditions", rows(entity("id", 1, "idChoices", 1, "type", "KEYS", "key", "MISSING_KEY")));
            assertTrue(validator().validateImportData(s).getErrors().stream()
                    .anyMatch(e -> "R4_CONDITION_KEY".equals(e.rule())));
        }

        @Test
        void keysTypeIsMatchedCaseInsensitively() {
            Map<String, Object> s = validStory();
            s.put("choiceConditions", rows(entity("id", 1, "idChoices", 1, "type", "keys", "key", "MISSING_KEY")));
            assertTrue(validator().validateImportData(s).getErrors().stream()
                    .anyMatch(e -> "R4_CONDITION_KEY".equals(e.rule())));
        }

        @Test
        void nonKeysConditionKeyIsNotARegistryRef() {
            // Step 31: on a statistics condition `key` names a STAT, not a registry key —
            // the pre-filter bug would have false-failed every such imported story.
            Map<String, Object> s = validStory();
            s.put("choiceConditions", rows(
                    entity("id", 1, "idChoices", 1, "type", "statistics", "key", "int", "value", "3", "operator", ">"),
                    entity("id", 2, "idChoices", 1, "type", "traits", "key", "9")));
            StoryValidationReport r = validator().validateImportData(s);
            assertTrue(r.isValid(), () -> "expected valid but got: " + r.getErrors());
        }

        @Test
        void conditionWithKnownKeyPasses() {
            Map<String, Object> s = validStory();
            s.put("choiceConditions", rows(entity("id", 1, "idChoices", 1, "type", "KEYS", "key", "chapter")));
            assertTrue(validator().validateImportData(s).isValid());
        }
    }

    @Nested
    @DisplayName("R8 choice-event binding (Step 31)")
    class ChoiceEventBinding {
        @Test
        void choiceWithoutEventFails() {
            Map<String, Object> s = validStory();
            s.put("choices", rows(entity("id", 1, "otherwiseFlag", 1)));
            StoryValidationReport r = validator().validateImportData(s);
            assertTrue(r.getErrors().stream().anyMatch(e ->
                    "R8_CHOICE_EVENT".equals(e.rule()) && "idEvent".equals(e.field())));
        }

        @Test
        void choiceWithLocationFails() {
            // Location 1 exists, so only R8 can complain — the binding itself is deprecated.
            Map<String, Object> s = validStory();
            s.put("choices", rows(entity("id", 1, "idEvent", 1, "idLocation", 1, "otherwiseFlag", 1)));
            StoryValidationReport r = validator().validateImportData(s);
            assertTrue(r.getErrors().stream().anyMatch(e ->
                    "R8_CHOICE_EVENT".equals(e.rule()) && "idLocation".equals(e.field())));
        }

        @Test
        void nonPositiveLocationReadsAsNone() {
            Map<String, Object> s = validStory();
            s.put("choices", rows(entity("id", 1, "idEvent", 1, "idLocation", 0, "otherwiseFlag", 1)));
            assertTrue(validator().validateImportData(s).isValid());
        }

        @Test
        void crudLocalToleratesADraftWithoutEvent() {
            // The lenient CRUD path: {priority: 1} must stay creatable while authoring.
            StoryValidationReport r = validator().validateEntity("choices", entity("priority", 1));
            assertTrue(r.isValid());
        }

        @Test
        void crudLocalRejectsALocation() {
            StoryValidationReport r = validator().validateEntity("choices",
                    entity("id", 1, "idEvent", 1, "idLocation", 5));
            assertTrue(r.getErrors().stream().anyMatch(e ->
                    "R8_CHOICE_EVENT".equals(e.rule()) && "idLocation".equals(e.field())));
        }
    }

    /**
     * Step 33 — the rules that keep an engine-fired location event runnable. Both are about
     * events a {@code list_locations.id_event_*} column names: the engine runs those without
     * a player, so an event that needs one is an authoring mistake, not a runtime problem.
     */
    @Nested
    @DisplayName("R9 automatic location events (Step 33)")
    class AutomaticLocationEvents {

        @Test
        @DisplayName("a location trigger that names a choice-owning event fails the import")
        void triggerPointingAtAChoiceEventFails() {
            Map<String, Object> s = validStory();
            // Event 1 owns choice 1 in the fixture; location 2 tries to fire it on entry.
            s.put("locations", rows(entity("id", 1), entity("id", 2, "idEventIfFirstTime", 1)));

            StoryValidationReport r = validator().validateImportData(s);

            assertTrue(r.getErrors().stream().anyMatch(e ->
                            "R9_AUTOMATIC_EVENT_CHOICES".equals(e.rule())
                                    && "idEventIfFirstTime".equals(e.field())),
                    "an automatic event has no one to ask and no response to ask in");
        }

        @Test
        @DisplayName("a location trigger naming a player-executable event fails the import")
        void triggerPointingAtANormalEventFails() {
            Map<String, Object> s = validStory();
            s.put("events", rows(entity("id", 1), entity("id", 2, "type", "NORMAL")));
            s.put("choices", rows());
            s.put("locations", rows(entity("id", 1), entity("id", 2, "idEventNotFirstTime", 2)));

            StoryValidationReport r = validator().validateImportData(s);

            assertTrue(r.getErrors().stream().anyMatch(e ->
                            "R9_AUTOMATIC_EVENT_TYPE".equals(e.rule())
                                    && "idEventNotFirstTime".equals(e.field())),
                    "the event would be offered as an action AND fire by itself");
        }

        @Test
        @DisplayName("an AUTOMATIC event with no choices is exactly what a trigger wants")
        void automaticEventWithoutChoicesIsValid() {
            Map<String, Object> s = validStory();
            s.put("events", rows(entity("id", 1), entity("id", 2, "type", "AUTOMATIC")));
            s.put("choices", rows());
            s.put("locations", rows(entity("id", 1),
                    entity("id", 2, "idEventIfFirstTime", 2, "idEventNotFirstTime", 2,
                            "idEventIfCharacterEnterEmptyLocation", 2, "idEventIfCounterZero", 2,
                            "idEventIfCharacterStartTime", 2)));

            assertTrue(validator().validateImportData(s).isValid());
        }

        @Test
        @DisplayName("a trigger pointing at an event that does not exist is a broken reference")
        void danglingTriggerIsReported() {
            Map<String, Object> s = validStory();
            s.put("locations", rows(entity("id", 1), entity("id", 2, "idEventIfCounterZero", 999)));

            StoryValidationReport r = validator().validateImportData(s);

            assertFalse(r.isValid());
            assertTrue(r.getErrors().stream().anyMatch(e ->
                    "idEventIfCounterZero".equals(e.field())));
        }

        @Test
        @DisplayName("a non-positive trigger column reads as 'no trigger', not as a broken one")
        void nonPositiveTriggerIsNoTrigger() {
            Map<String, Object> s = validStory();
            s.put("choices", rows());
            s.put("locations", rows(entity("id", 1),
                    entity("id", 2, "idEventIfFirstTime", 0, "idEventNotFirstTime", 0)));

            assertTrue(validator().validateImportData(s).isValid());
        }
    }

    @Nested
    @DisplayName("R5/R6 items, templates, classes")
    class TemplatesAndClasses {
        @Test
        void itemRefersMissingClass() {
            Map<String, Object> s = validStory();
            s.put("items", rows(entity("id", 1, "idClassPermitted", 9)));
            assertFalse(validator().validateImportData(s).isValid());
        }

        @Test
        void templateNegativeStat() {
            Map<String, Object> s = validStory();
            s.put("characterTemplates", rows(entity("id", 1, "lifeMax", 10, "energyMax", 10, "dexterityStart", -3)));
            assertTrue(validator().validateImportData(s).getErrors().stream()
                    .anyMatch(e -> "R6_STAT_RANGE".equals(e.rule())));
        }

        @Test
        void templateZeroLifeMax() {
            Map<String, Object> s = validStory();
            s.put("characterTemplates", rows(entity("id", 1, "lifeMax", 0, "energyMax", 10)));
            assertFalse(validator().validateImportData(s).isValid());
        }

        @Test
        void templatePermittedEqualsProhibited() {
            Map<String, Object> s = validStory();
            s.put("characterTemplates", rows(entity("id", 1, "lifeMax", 10, "energyMax", 10,
                    "idClassPermitted", 1, "idClassProhibited", 1)));
            assertTrue(validator().validateImportData(s).getErrors().stream()
                    .anyMatch(e -> "R6_CLASS_CONFLICT".equals(e.rule())));
        }
    }

    @Nested
    @DisplayName("R7 missions / weather / random events")
    class Misc {
        @Test
        void missionStepRefersMissingMission() {
            Map<String, Object> s = validStory();
            s.put("missionSteps", rows(entity("id", 1, "idMission", 5)));
            assertFalse(validator().validateImportData(s).isValid());
        }

        @Test
        void weatherRuleRefersMissingEvent() {
            Map<String, Object> s = validStory();
            s.put("weatherRules", rows(entity("id", 1, "idEvent", 6)));
            assertFalse(validator().validateImportData(s).isValid());
        }
    }

    @Nested
    @DisplayName("validateEntity (lenient CRUD)")
    class EntityLocal {
        @Test
        void forwardClassReferenceAllowed() {
            // an idClassPermitted pointing to a class that doesn't exist yet must NOT fail CRUD
            StoryValidationReport r = validator().validateEntity("items",
                    entity("id", 1, "idClassPermitted", 999));
            assertTrue(r.isValid());
        }

        @Test
        void badStatRangeRejected() {
            StoryValidationReport r = validator().validateEntity("character-templates",
                    entity("id", 1, "lifeMax", -5, "energyMax", 10));
            assertFalse(r.isValid());
        }

        @Test
        void classConflictRejected() {
            StoryValidationReport r = validator().validateEntity("traits",
                    entity("id", 1, "idClassPermitted", 3, "idClassProhibited", 3));
            assertFalse(r.isValid());
        }

        @Test
        void difficultyRangeRejected() {
            StoryValidationReport r = validator().validateEntity("difficulties",
                    entity("id", 1, "minCharacter", 4, "maxCharacter", 2));
            assertFalse(r.isValid());
        }

        @Test
        void unknownEntityTypeIsValid() {
            assertTrue(validator().validateEntity("locations", entity("id", 1)).isValid());
            assertTrue(validator().validateEntity(null, entity("id", 1)).isValid());
        }
    }

    @Nested
    @DisplayName("validateStory (persisted, via StoryReadPort)")
    class PersistedStory {
        @Test
        void nullStoryIdReported() {
            assertFalse(validator().validateStory(null).isValid());
        }

        @Test
        void brokenChoiceEventFromDb() {
            long sid = 7L;
            LocationEntity loc = new LocationEntity();
            loc.setId(1L);
            EventEntity ev = new EventEntity();
            ev.setId(1L);
            ChoiceEntity ch = new ChoiceEntity();
            ch.setId(1L);
            ch.setIdEvent(55); // missing event
            ch.setOtherwiseFlag(1);

            lenient().when(readPort.findLocationsByStoryId(sid)).thenReturn(List.of(loc));
            lenient().when(readPort.findEventsByStoryId(sid)).thenReturn(List.of(ev));
            lenient().when(readPort.findItemsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findChoicesByStoryId(sid)).thenReturn(List.of(ch));
            lenient().when(readPort.findClassesByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findMissionsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findKeysByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findChoiceEffectsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findChoiceConditionsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findEventEffectsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findItemEffectsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findClassBonusesByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findMissionStepsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findWeatherRulesByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findGlobalRandomEventsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findLocationNeighborsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findTraitsByStoryId(sid)).thenReturn(List.of());
            lenient().when(readPort.findCharacterTemplatesByStoryId(sid)).thenReturn(List.of());

            StoryValidationReport r = validator().validateStory(sid);
            assertFalse(r.isValid());
            assertTrue(r.getErrors().stream().anyMatch(e -> "idEvent".equals(e.field())));
        }
    }
}
