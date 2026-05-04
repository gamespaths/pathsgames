package games.paths.core.service.story;

import games.paths.core.entity.story.*;
import games.paths.core.model.story.StoryImportResult;
import games.paths.core.port.story.StoryPersistencePort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import org.mockito.ArgumentCaptor;

/**
 * Unit tests for {@link StoryImportService}.
 * Ensures full branch coverage for story import, deletion, and edge cases.
 */
@ExtendWith(MockitoExtension.class)
class StoryImportServiceTest {

    @Mock
    private StoryPersistencePort persistencePort;

    @InjectMocks
    private StoryImportService storyImportService;

    @BeforeEach
    void setUp() {
        lenient().when(persistencePort.nextStoryScopedId(anyString(), anyString(), anyLong())).thenReturn(1L);
    }

    // === Helper Methods ===

    private StoryEntity savedStoryEntity(String uuid) {
        StoryEntity e = new StoryEntity();
        e.setId(1L);
        e.setUuid(uuid);
        return e;
    }

    // === SECTION: IMPORT STORY ===

    @Nested
    @DisplayName("Import Story Tests")
    class ImportStory {

        @Test
        @DisplayName("Should throw IllegalArgumentException for null data")
        void importStory_nullData() {
            assertThrows(IllegalArgumentException.class, () -> storyImportService.importStory(null));
        }

        @Test
        @DisplayName("Should throw IllegalArgumentException for empty data")
        void importStory_emptyData() {
            assertThrows(IllegalArgumentException.class, () -> storyImportService.importStory(Map.of()));
        }

        @Test
        @DisplayName("Should import minimal story with auto-generated UUID")
        void importStory_minimalWithAutoUuid() {
            Map<String, Object> data = new HashMap<>();
            data.put("author", "TestAuthor");

            when(persistencePort.findStoryByUuid(anyString())).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });

            StoryImportResult result = storyImportService.importStory(data);

            assertNotNull(result);
            assertEquals("IMPORTED", result.getStatus());
            assertNotNull(result.getStoryUuid());
            verify(persistencePort, times(2)).saveStory(any(StoryEntity.class));
        }

        @Test
        @DisplayName("Should import story with specified UUID and replace existing")
        void importStory_replaceExisting() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "existing-uuid");
            data.put("author", "Author");

            StoryEntity existing = savedStoryEntity("existing-uuid");
            when(persistencePort.findStoryByUuid("existing-uuid")).thenReturn(Optional.of(existing));
            doNothing().when(persistencePort).deleteStoryData(1L);
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(2L);
                return e;
            });

            StoryImportResult result = storyImportService.importStory(data);

            assertEquals("existing-uuid", result.getStoryUuid());
            verify(persistencePort).deleteStoryData(1L);
        }

        @Test
        @DisplayName("Should preserve explicit story ID when provided and available")
        void importStory_withExplicitStoryId() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "explicit-id-uuid");
            data.put("id", 77);

            when(persistencePort.findStoryByUuid("explicit-id-uuid")).thenReturn(Optional.empty());
            when(persistencePort.existsStoryId(77L)).thenReturn(false);
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                if (e.getId() == null) {
                    e.setId(77L);
                }
                return e;
            });

            StoryImportResult result = storyImportService.importStory(data);

            assertEquals("explicit-id-uuid", result.getStoryUuid());
            ArgumentCaptor<StoryEntity> captor = ArgumentCaptor.forClass(StoryEntity.class);
            verify(persistencePort, atLeastOnce()).saveStory(captor.capture());
            assertEquals(77L, captor.getAllValues().get(0).getId());
        }

        @Test
        @DisplayName("Should allow same explicit event id in different story scopes")
        void importStory_sameEventIdAcrossDifferentStories() {
            Map<String, Object> story1 = new HashMap<>();
            story1.put("uuid", "story-uuid-1");
            story1.put("events", List.of(Map.of("id", 1, "idTextName", 10)));

            Map<String, Object> story2 = new HashMap<>();
            story2.put("uuid", "story-uuid-2");
            story2.put("events", List.of(Map.of("id", 1, "idTextName", 20)));

            when(persistencePort.findStoryByUuid("story-uuid-1")).thenReturn(Optional.empty());
            when(persistencePort.findStoryByUuid("story-uuid-2")).thenReturn(Optional.empty());
            when(persistencePort.existsEventId(1L, 101L)).thenReturn(false);
            when(persistencePort.existsEventId(1L, 202L)).thenReturn(false);

            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(new org.mockito.stubbing.Answer<StoryEntity>() {
                private int count = 0;
                @Override
                public StoryEntity answer(org.mockito.invocation.InvocationOnMock invocation) {
                    StoryEntity e = invocation.getArgument(0);
                    if (e.getId() == null) {
                        e.setId((count++ == 0) ? 101L : 202L);
                    }
                    return e;
                }
            });
            when(persistencePort.saveEvents(anyList())).thenAnswer(inv -> inv.getArgument(0));

            StoryImportResult r1 = storyImportService.importStory(story1);
            StoryImportResult r2 = storyImportService.importStory(story2);

            assertEquals("story-uuid-1", r1.getStoryUuid());
            assertEquals("story-uuid-2", r2.getStoryUuid());

            ArgumentCaptor<List<EventEntity>> eventsCaptor = ArgumentCaptor.forClass(List.class);
            verify(persistencePort, times(2)).saveEvents(eventsCaptor.capture());

            EventEntity first = eventsCaptor.getAllValues().get(0).get(0);
            EventEntity second = eventsCaptor.getAllValues().get(1).get(0);
            assertEquals(1L, first.getId());
            assertEquals(1L, second.getId());
            assertEquals(101L, first.getIdStory());
            assertEquals(202L, second.getIdStory());
        }

        @Test
        @DisplayName("Should stop import when explicit story ID already exists")
        void importStory_withDuplicateStoryId_shouldFail() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "dup-id-uuid");
            data.put("id", 10);

            when(persistencePort.findStoryByUuid("dup-id-uuid")).thenReturn(Optional.empty());
            when(persistencePort.existsStoryId(10L)).thenReturn(true);

            IllegalArgumentException ex = assertThrows(
                    IllegalArgumentException.class,
                    () -> storyImportService.importStory(data)
            );

            assertEquals("story/list_stories id=10 already present", ex.getMessage());
            verify(persistencePort, never()).saveStory(any(StoryEntity.class));
        }

        @Test
        @DisplayName("Should import story with all sub-entity types")
        void importStory_withAllSubEntities() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "full-uuid");
            data.put("author", "FullAuthor");
            data.put("idTextTitle", 100);
            data.put("idTextDescription", 101);
            data.put("idTextCopyright", 102);
            data.put("visibility", "PUBLIC");
            data.put("category", "adventure");
            data.put("group", "fantasy");
            data.put("priority", 5);
            data.put("peghi", 2);
            data.put("versionMin", "0.10");
            data.put("versionMax", "1.0");
            data.put("clockSingularDescription", "turn");
            data.put("clockPluralDescription", "turns");
            data.put("linkCopyright", "https://example.com");

            // Sub-entities
            data.put("texts", List.of(Map.of("idText", 100, "lang", "en", "shortText", "Title")));
            data.put("difficulties", List.of(Map.of("expCost", 5, "maxWeight", 10)));
            data.put("classes", List.of(Map.of("idTextName", 200)));
            data.put("locations", List.of(Map.of("idTextName", 300)));
            data.put("events", List.of(Map.of("idTextName", 400, "type", "NORMAL")));
            data.put("items", List.of(Map.of("idTextName", 500)));
            data.put("choices", List.of(Map.of("idTextName", 600)));
            data.put("creators", List.of(Map.of("link", "creator-link")));
            data.put("cards", List.of(Map.of("urlImmage", "img.png")));
            data.put("keys", List.of(Map.of("name", "key1", "value", "val1")));
            data.put("traits", List.of(Map.of("idTextName", 700)));
            data.put("characterTemplates", List.of(Map.of("lifeMax", 20)));
            data.put("weatherRules", List.of(Map.of("probability", 50)));
            data.put("globalRandomEvents", List.of(Map.of("probability", 10)));
            data.put("missions", List.of(Map.of("conditionKey", "key1")));

            when(persistencePort.findStoryByUuid("full-uuid")).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });
            when(persistencePort.saveTexts(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveDifficulties(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveClasses(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveLocations(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveEvents(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveItems(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveChoices(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveCreators(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveCards(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveKeys(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveTraits(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveCharacterTemplates(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveWeatherRules(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveGlobalRandomEvents(anyList())).thenAnswer(inv -> inv.getArgument(0));
            when(persistencePort.saveMissions(anyList())).thenAnswer(inv -> inv.getArgument(0));

            StoryImportResult result = storyImportService.importStory(data);

            assertAll("Import result counts",
                () -> assertEquals("full-uuid", result.getStoryUuid()),
                () -> assertEquals("IMPORTED", result.getStatus()),
                () -> assertEquals(1, result.getTextsImported()),
                () -> assertEquals(1, result.getDifficultiesImported()),
                () -> assertEquals(1, result.getClassesImported()),
                () -> assertEquals(1, result.getLocationsImported()),
                () -> assertEquals(1, result.getEventsImported()),
                () -> assertEquals(1, result.getItemsImported()),
                () -> assertEquals(1, result.getChoicesImported())
            );
        }

        @Test
        @DisplayName("Should handle empty sub-entity lists gracefully")
        void importStory_emptySubEntities() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "empty-uuid");
            data.put("texts", List.of());
            data.put("difficulties", List.of());
            data.put("classes", List.of());
            data.put("locations", List.of());
            data.put("events", List.of());
            data.put("items", List.of());
            data.put("choices", List.of());
            data.put("creators", List.of());
            data.put("cards", List.of());
            data.put("keys", List.of());
            data.put("traits", List.of());
            data.put("characterTemplates", List.of());
            data.put("weatherRules", List.of());
            data.put("globalRandomEvents", List.of());
            data.put("missions", List.of());

            when(persistencePort.findStoryByUuid("empty-uuid")).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });

            StoryImportResult result = storyImportService.importStory(data);

            assertAll("Zero imports",
                () -> assertEquals(0, result.getTextsImported()),
                () -> assertEquals(0, result.getDifficultiesImported()),
                () -> assertEquals(0, result.getLocationsImported()),
                () -> assertEquals(0, result.getEventsImported()),
                () -> assertEquals(0, result.getItemsImported()),
                () -> assertEquals(0, result.getClassesImported()),
                () -> assertEquals(0, result.getChoicesImported())
            );
        }

        @Test
        @DisplayName("Should handle blank UUID in data (auto-generate)")
        void importStory_blankUuid() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "  ");
            data.put("author", "Author");

            when(persistencePort.findStoryByUuid(anyString())).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });

            StoryImportResult result = storyImportService.importStory(data);

            assertNotNull(result.getStoryUuid());
            assertFalse(result.getStoryUuid().isBlank());
        }

        @Test
        @DisplayName("Should handle non-list values for sub-entity keys")
        void importStory_nonListSubEntities() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "test-uuid");
            data.put("texts", "not-a-list"); // should be ignored

            when(persistencePort.findStoryByUuid("test-uuid")).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });

            StoryImportResult result = storyImportService.importStory(data);

            assertEquals(0, result.getTextsImported());
        }

        @Test
        @DisplayName("Should parse string values to integers for numeric fields")
        void importStory_stringToInteger() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "test-uuid");
            data.put("priority", "42");
            data.put("peghi", "invalid"); // non-parseable should be null

            when(persistencePort.findStoryByUuid("test-uuid")).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });

            StoryImportResult result = storyImportService.importStory(data);

            assertNotNull(result);
        }

        @Test
        @DisplayName("Should handle text with null lang (default to 'en')")
        void importStory_textNullLang() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "test-uuid");
            Map<String, Object> textData = new HashMap<>();
            textData.put("idText", 1);
            textData.put("shortText", "Text");
            // lang not set
            data.put("texts", List.of(textData));

            when(persistencePort.findStoryByUuid("test-uuid")).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });
            when(persistencePort.saveTexts(anyList())).thenAnswer(inv -> inv.getArgument(0));

            StoryImportResult result = storyImportService.importStory(data);

            assertEquals(1, result.getTextsImported());
        }
    }

    // === SECTION: DELETE STORY ===

    @Nested
    @DisplayName("Delete Story Tests")
    class DeleteStory {

        @Test
        @DisplayName("Should return false for null UUID")
        void deleteStory_nullUuid() {
            assertFalse(storyImportService.deleteStory(null));
        }

        @Test
        @DisplayName("Should return false for blank UUID")
        void deleteStory_blankUuid() {
            assertFalse(storyImportService.deleteStory("  "));
        }

        @Test
        @DisplayName("Should return false when story not found")
        void deleteStory_notFound() {
            when(persistencePort.findStoryByUuid("unknown")).thenReturn(Optional.empty());
            assertFalse(storyImportService.deleteStory("unknown"));
        }

        @Test
        @DisplayName("Should delete story and return true when found")
        void deleteStory_success() {
            StoryEntity existing = savedStoryEntity("uuid-1");
            when(persistencePort.findStoryByUuid("uuid-1")).thenReturn(Optional.of(existing));
            doNothing().when(persistencePort).deleteStoryData(1L);

            assertTrue(storyImportService.deleteStory("uuid-1"));
            verify(persistencePort).deleteStoryData(1L);
        }
    }

    // === SECTION: LIST STORY UUIDS ===

    @Test
    @DisplayName("listStoryUuids should return empty list (placeholder)")
    void listStoryUuids_returnsEmpty() {
        lenient().when(persistencePort.findStoryByUuid("__list_all__")).thenReturn(Optional.empty());
        List<String> result = storyImportService.listStoryUuids();
        assertNotNull(result);
        assertTrue(result.isEmpty());
    }

    // === SECTION: RELATIONAL ENTITY IMPORTS ===

    @Nested
    @DisplayName("Relational entity import tests")
    class RelationalEntityImports {

        private StoryEntity setupStory(String uuid) {
            when(persistencePort.findStoryByUuid(uuid)).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });
            return new StoryEntity();
        }

        @Test
        @DisplayName("Should import locationNeighbors")
        void importStory_withLocationNeighbors() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "ln-uuid");
            data.put("locationNeighbors", List.of(Map.of("idLocationFrom", 1, "idLocationTo", 2, "direction", "NORTH")));
            setupStory("ln-uuid");
            when(persistencePort.saveLocationNeighbors(anyList())).thenAnswer(inv -> inv.getArgument(0));

            storyImportService.importStory(data);

            verify(persistencePort).saveLocationNeighbors(argThat(list -> list.size() == 1));
        }

        @Test
        @DisplayName("Should import eventEffects")
        void importStory_withEventEffects() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "ee-uuid");
            data.put("eventEffects", List.of(Map.of("idEvent", 1, "statistics", "life", "value", 5)));
            setupStory("ee-uuid");
            when(persistencePort.saveEventEffects(anyList())).thenAnswer(inv -> inv.getArgument(0));

            storyImportService.importStory(data);

            verify(persistencePort).saveEventEffects(argThat(list -> list.size() == 1));
        }

        @Test
        @DisplayName("Should import itemEffects")
        void importStory_withItemEffects() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "ie-uuid");
            data.put("itemEffects", List.of(Map.of("idItem", 2, "effectCode", "HEAL", "effectValue", 10)));
            setupStory("ie-uuid");
            when(persistencePort.saveItemEffects(anyList())).thenAnswer(inv -> inv.getArgument(0));

            storyImportService.importStory(data);

            verify(persistencePort).saveItemEffects(argThat(list -> list.size() == 1));
        }

        @Test
        @DisplayName("Should import choiceConditions")
        void importStory_withChoiceConditions() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "cc-uuid");
            data.put("choiceConditions", List.of(Map.of("idChoices", 3, "type", "KEY", "key", "k1", "value", "v1", "operator", "EQ")));
            setupStory("cc-uuid");
            when(persistencePort.saveChoiceConditions(anyList())).thenAnswer(inv -> inv.getArgument(0));

            storyImportService.importStory(data);

            verify(persistencePort).saveChoiceConditions(argThat(list -> list.size() == 1));
        }

        @Test
        @DisplayName("Should import choiceEffects")
        void importStory_withChoiceEffects() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "ce-uuid");
            data.put("choiceEffects", List.of(Map.of("idChoices", 4, "statistics", "energy", "value", 3)));
            setupStory("ce-uuid");
            when(persistencePort.saveChoiceEffects(anyList())).thenAnswer(inv -> inv.getArgument(0));

            storyImportService.importStory(data);

            verify(persistencePort).saveChoiceEffects(argThat(list -> list.size() == 1));
        }

        @Test
        @DisplayName("Should import classBonuses")
        void importStory_withClassBonuses() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "cb-uuid");
            data.put("classBonuses", List.of(Map.of("idClass", 1, "statistic", "dexterity", "value", 2)));
            setupStory("cb-uuid");
            when(persistencePort.saveClassBonuses(anyList())).thenAnswer(inv -> inv.getArgument(0));

            storyImportService.importStory(data);

            verify(persistencePort).saveClassBonuses(argThat(list -> list.size() == 1));
        }

        @Test
        @DisplayName("Should import missionSteps")
        void importStory_withMissionSteps() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "ms-uuid");
            data.put("missionSteps", List.of(Map.of("idMission", 1, "step", 1)));
            setupStory("ms-uuid");
            when(persistencePort.saveMissionSteps(anyList())).thenAnswer(inv -> inv.getArgument(0));

            storyImportService.importStory(data);

            verify(persistencePort).saveMissionSteps(argThat(list -> list.size() == 1));
        }

        @Test
        @DisplayName("Should throw when duplicate scoped entity id is detected")
        void importStory_duplicateScopedEntityId() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "dup-scope-uuid");
            data.put("locations", List.of(Map.of("id", 5)));
            when(persistencePort.findStoryByUuid("dup-scope-uuid")).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });
            when(persistencePort.existsLocationId(5L, 1L)).thenReturn(true);

            assertThrows(IllegalArgumentException.class, () -> storyImportService.importStory(data));
        }

        @Test
        @DisplayName("Should auto-generate scoped id when no explicit id provided for relational entity")
        void importStory_autoGenerateScopedIdForRelationalEntity() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "auto-scope-uuid");
            data.put("locationNeighbors", List.of(Map.of("idLocationFrom", 1, "idLocationTo", 2)));
            when(persistencePort.findStoryByUuid("auto-scope-uuid")).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(10L);
                return e;
            });
            when(persistencePort.nextStoryScopedId(anyString(), anyString(), eq(10L))).thenReturn(1L);
            when(persistencePort.saveLocationNeighbors(anyList())).thenAnswer(inv -> inv.getArgument(0));

            storyImportService.importStory(data);

            verify(persistencePort).saveLocationNeighbors(anyList());
        }

        @Test
        @DisplayName("getLong should parse string values")
        void importStory_getLongStringParsing() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "str-long-uuid");
            data.put("id", "55"); // string id that should be parsed to Long

            when(persistencePort.findStoryByUuid("str-long-uuid")).thenReturn(Optional.empty());
            when(persistencePort.existsStoryId(55L)).thenReturn(false);
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                if (e.getId() == null) e.setId(55L);
                return e;
            });

            StoryImportResult result = storyImportService.importStory(data);
            assertNotNull(result);
        }

        @Test
        @DisplayName("getLong should return null for unparseable string")
        void importStory_getLongUnparseableString() {
            Map<String, Object> data = new HashMap<>();
            data.put("uuid", "bad-long-uuid");
            data.put("id", "not-a-number"); // unparseable, should be ignored

            when(persistencePort.findStoryByUuid("bad-long-uuid")).thenReturn(Optional.empty());
            when(persistencePort.saveStory(any(StoryEntity.class))).thenAnswer(inv -> {
                StoryEntity e = inv.getArgument(0);
                e.setId(1L);
                return e;
            });

            StoryImportResult result = storyImportService.importStory(data);
            assertNotNull(result);
        }
    }
}
