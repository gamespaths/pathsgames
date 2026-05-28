package games.paths.core.persistence.story;

import games.paths.core.entity.story.*;
import games.paths.core.repository.story.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.jdbc.core.JdbcTemplate;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link StoryPersistenceAdapter}.
 * Verifies delegation to the correct JPA repositories.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class StoryPersistenceAdapterTest {

    @Mock private StoryRepository storyRepository;
    @Mock private TextRepository textRepository;
    @Mock private StoryDifficultyRepository difficultyRepository;
    @Mock private CreatorRepository creatorRepository;
    @Mock private CardRepository cardRepository;
    @Mock private KeyRepository keyRepository;
    @Mock private ClassRepository classRepository;
    @Mock private ClassBonusRepository classBonusRepository;
    @Mock private TraitRepository traitRepository;
    @Mock private CharacterTemplateRepository characterTemplateRepository;
    @Mock private LocationRepository locationRepository;
    @Mock private LocationNeighborRepository locationNeighborRepository;
    @Mock private ItemRepository itemRepository;
    @Mock private ItemEffectRepository itemEffectRepository;
    @Mock private WeatherRuleRepository weatherRuleRepository;
    @Mock private EventRepository eventRepository;
    @Mock private EventEffectRepository eventEffectRepository;
    @Mock private ChoiceRepository choiceRepository;
    @Mock private ChoiceConditionRepository choiceConditionRepository;
    @Mock private ChoiceEffectRepository choiceEffectRepository;
    @Mock private GlobalRandomEventRepository globalRandomEventRepository;
    @Mock private MissionRepository missionRepository;
    @Mock private MissionStepRepository missionStepRepository;
    @Mock private JdbcTemplate jdbcTemplate;
    @Mock private EntityManager entityManager;

    @InjectMocks
    private StoryPersistenceAdapter adapter;

    @Nested
    @DisplayName("Save Operations")
    class SaveOperations {

        @Test
        @DisplayName("saveStory should persist when id is new")
        void saveStory() {
            StoryEntity entity = new StoryEntity();
            entity.setUuid("test-uuid");
            when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(10L);
            when(storyRepository.existsById(10L)).thenReturn(false);

            StoryEntity result = adapter.saveStory(entity);

            assertEquals("test-uuid", result.getUuid());
            assertEquals(10L, result.getId());
            verify(entityManager).persist(entity);
            verify(entityManager).flush();
        }

        @Test
        @DisplayName("saveTexts should persist all entities")
        void saveTexts() {
            List<TextEntity> texts = List.of(new TextEntity());

            assertEquals(1, adapter.saveTexts(texts).size());
            verify(entityManager).persist(texts.get(0));
            verify(entityManager).flush();
        }

        @Test
        @DisplayName("saveDifficulties should delegate to difficultyRepository.saveAll")
        void saveDifficulties() {
            List<StoryDifficultyEntity> diffs = List.of(new StoryDifficultyEntity());
            when(difficultyRepository.saveAll(diffs)).thenReturn(diffs);

            assertEquals(1, adapter.saveDifficulties(diffs).size());
        }

        @Test
        @DisplayName("saveCreators should delegate to creatorRepository.saveAll")
        void saveCreators() {
            List<CreatorEntity> list = List.of(new CreatorEntity());
            when(creatorRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveCreators(list).size());
        }

        @Test
        @DisplayName("saveCards should delegate to cardRepository.saveAll")
        void saveCards() {
            List<CardEntity> list = List.of(new CardEntity());
            when(cardRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveCards(list).size());
        }

        @Test
        @DisplayName("saveKeys should delegate to keyRepository.saveAll")
        void saveKeys() {
            List<KeyEntity> list = List.of(new KeyEntity());
            when(keyRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveKeys(list).size());
        }

        @Test
        @DisplayName("saveClasses should delegate to classRepository.saveAll")
        void saveClasses() {
            List<ClassEntity> list = List.of(new ClassEntity());
            when(classRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveClasses(list).size());
        }

        @Test
        @DisplayName("saveClassBonuses should delegate to classBonusRepository.saveAll")
        void saveClassBonuses() {
            List<ClassBonusEntity> list = List.of(new ClassBonusEntity());
            when(classBonusRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveClassBonuses(list).size());
        }

        @Test
        @DisplayName("saveTraits should delegate to traitRepository.saveAll")
        void saveTraits() {
            List<TraitEntity> list = List.of(new TraitEntity());
            when(traitRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveTraits(list).size());
        }

        @Test
        @DisplayName("saveCharacterTemplates should delegate to characterTemplateRepository.saveAll")
        void saveCharacterTemplates() {
            List<CharacterTemplateEntity> list = List.of(new CharacterTemplateEntity());
            when(characterTemplateRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveCharacterTemplates(list).size());
        }

        @Test
        @DisplayName("saveLocations should delegate to locationRepository.saveAll")
        void saveLocations() {
            List<LocationEntity> list = List.of(new LocationEntity());
            when(locationRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveLocations(list).size());
        }

        @Test
        @DisplayName("saveLocationNeighbors should delegate to locationNeighborRepository.saveAll")
        void saveLocationNeighbors() {
            List<LocationNeighborEntity> list = List.of(new LocationNeighborEntity());
            when(locationNeighborRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveLocationNeighbors(list).size());
        }

        @Test
        @DisplayName("saveItems should delegate to itemRepository.saveAll")
        void saveItems() {
            List<ItemEntity> list = List.of(new ItemEntity());
            when(itemRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveItems(list).size());
        }

        @Test
        @DisplayName("saveItemEffects should delegate to itemEffectRepository.saveAll")
        void saveItemEffects() {
            List<ItemEffectEntity> list = List.of(new ItemEffectEntity());
            when(itemEffectRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveItemEffects(list).size());
        }

        @Test
        @DisplayName("saveWeatherRules should delegate to weatherRuleRepository.saveAll")
        void saveWeatherRules() {
            List<WeatherRuleEntity> list = List.of(new WeatherRuleEntity());
            when(weatherRuleRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveWeatherRules(list).size());
        }

        @Test
        @DisplayName("saveEvents should delegate to eventRepository.saveAll")
        void saveEvents() {
            List<EventEntity> list = List.of(new EventEntity());
            when(eventRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveEvents(list).size());
        }

        @Test
        @DisplayName("saveEventEffects should delegate to eventEffectRepository.saveAll")
        void saveEventEffects() {
            List<EventEffectEntity> list = List.of(new EventEffectEntity());
            when(eventEffectRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveEventEffects(list).size());
        }

        @Test
        @DisplayName("saveChoices should delegate to choiceRepository.saveAll")
        void saveChoices() {
            List<ChoiceEntity> list = List.of(new ChoiceEntity());
            when(choiceRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveChoices(list).size());
        }

        @Test
        @DisplayName("saveChoiceConditions should delegate to choiceConditionRepository.saveAll")
        void saveChoiceConditions() {
            List<ChoiceConditionEntity> list = List.of(new ChoiceConditionEntity());
            when(choiceConditionRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveChoiceConditions(list).size());
        }

        @Test
        @DisplayName("saveChoiceEffects should delegate to choiceEffectRepository.saveAll")
        void saveChoiceEffects() {
            List<ChoiceEffectEntity> list = List.of(new ChoiceEffectEntity());
            when(choiceEffectRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveChoiceEffects(list).size());
        }

        @Test
        @DisplayName("saveGlobalRandomEvents should delegate to globalRandomEventRepository.saveAll")
        void saveGlobalRandomEvents() {
            List<GlobalRandomEventEntity> list = List.of(new GlobalRandomEventEntity());
            when(globalRandomEventRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveGlobalRandomEvents(list).size());
        }

        @Test
        @DisplayName("saveMissions should delegate to missionRepository.saveAll")
        void saveMissions() {
            List<MissionEntity> list = List.of(new MissionEntity());
            when(missionRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveMissions(list).size());
        }

        @Test
        @DisplayName("saveMissionSteps should delegate to missionStepRepository.saveAll")
        void saveMissionSteps() {
            List<MissionStepEntity> list = List.of(new MissionStepEntity());
            when(missionStepRepository.saveAll(list)).thenReturn(list);
            assertEquals(1, adapter.saveMissionSteps(list).size());
        }

        @Test
        @DisplayName("syncStorySequences should execute sequence sync queries safely")
        void syncStorySequences() {
            adapter.syncStorySequences();
            verify(jdbcTemplate, atLeastOnce()).queryForObject(anyString(), eq(Long.class));
        }

        @Test
        @DisplayName("nextStoryScopedId should query max+1 inside story scope")
        void nextStoryScopedId() {
            when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(77L))).thenReturn(12L);

            Long next = adapter.nextStoryScopedId("list_events", "id", 77L);

            assertEquals(12L, next);
            verify(jdbcTemplate).queryForObject(contains("FROM list_events"), eq(Long.class), eq(77L));
        }

        @Test
        @DisplayName("nextStoryScopedId returns 1 when jdbcTemplate returns null")
        void nextStoryScopedId_nullResult() {
            when(jdbcTemplate.queryForObject(anyString(), eq(Long.class), eq(1L))).thenReturn(null);
            assertEquals(1L, adapter.nextStoryScopedId("list_events", "id", 1L));
        }

        @Test
        @DisplayName("nextStoryScopedId returns null when any param is null")
        void nextStoryScopedId_nullParams() {
            assertNull(adapter.nextStoryScopedId(null, "id", 1L));
            assertNull(adapter.nextStoryScopedId("list_events", null, 1L));
            assertNull(adapter.nextStoryScopedId("list_events", "id", null));
        }

        @Test
        @DisplayName("nextStoryScopedId throws on invalid identifier")
        void nextStoryScopedId_invalidIdentifier() {
            assertThrows(IllegalArgumentException.class,
                    () -> adapter.nextStoryScopedId("list events; DROP TABLE", "id", 1L));
        }

        @Test
        @DisplayName("nextGlobalId returns 1 when jdbcTemplate returns null")
        void nextGlobalId_nullResult() {
            when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(null);
            assertEquals(1L, adapter.nextGlobalId("list_stories", "id"));
        }

        @Test
        @DisplayName("nextGlobalId returns value from jdbcTemplate")
        void nextGlobalId_value() {
            when(jdbcTemplate.queryForObject(anyString(), eq(Long.class))).thenReturn(5L);
            assertEquals(5L, adapter.nextGlobalId("list_stories", "id"));
        }

        @Test
        @DisplayName("nextGlobalId throws on invalid identifier")
        void nextGlobalId_invalidIdentifier() {
            assertThrows(IllegalArgumentException.class,
                    () -> adapter.nextGlobalId("list stories", "id"));
        }

        @Test
        @DisplayName("saveStory merges when entity id already exists")
        void saveStory_existingId() {
            StoryEntity entity = new StoryEntity();
            entity.setId(99L);
            when(storyRepository.existsById(99L)).thenReturn(true);
            when(storyRepository.save(entity)).thenReturn(entity);

            StoryEntity result = adapter.saveStory(entity);

            assertEquals(99L, result.getId());
            verify(storyRepository).save(entity);
            verify(entityManager, never()).persist(any());
        }
    }

    @Nested
    @DisplayName("Find Operations")
    class FindOperations {

        @Test
        @DisplayName("findStoryByUuid should delegate to storyRepository.findByUuid")
        void findStoryByUuid() {
            StoryEntity entity = new StoryEntity();
            entity.setUuid("uuid-1");
            when(storyRepository.findByUuid("uuid-1")).thenReturn(Optional.of(entity));

            Optional<StoryEntity> result = adapter.findStoryByUuid("uuid-1");

            assertTrue(result.isPresent());
            assertEquals("uuid-1", result.get().getUuid());
        }

        @Test
        @DisplayName("findStoryByUuid should return empty for unknown UUID")
        void findStoryByUuid_notFound() {
            when(storyRepository.findByUuid("unknown")).thenReturn(Optional.empty());

            assertTrue(adapter.findStoryByUuid("unknown").isEmpty());
        }
    }

    @Nested
    @DisplayName("Delete Operations")
    class DeleteOperations {

        @Test
        @DisplayName("deleteStoryData should delete all sub-tables in reverse dependency order")
        void deleteStoryData() {
            adapter.deleteStoryData(1L);

            // Verify deletions happen in reverse dependency order
            var inOrder = inOrder(
                    missionStepRepository, missionRepository,
                    globalRandomEventRepository,
                    choiceEffectRepository, choiceConditionRepository, choiceRepository,
                    eventEffectRepository, eventRepository,
                    weatherRuleRepository,
                    itemEffectRepository, itemRepository,
                    locationNeighborRepository, locationRepository,
                    characterTemplateRepository, traitRepository,
                    classBonusRepository, classRepository,
                    keyRepository, cardRepository, creatorRepository,
                    textRepository, difficultyRepository, storyRepository
            );

            inOrder.verify(missionStepRepository).deleteByIdStory(1L);
            inOrder.verify(missionRepository).deleteByIdStory(1L);
            inOrder.verify(globalRandomEventRepository).deleteByIdStory(1L);
            inOrder.verify(choiceEffectRepository).deleteByIdStory(1L);
            inOrder.verify(choiceConditionRepository).deleteByIdStory(1L);
            inOrder.verify(choiceRepository).deleteByIdStory(1L);
            inOrder.verify(eventEffectRepository).deleteByIdStory(1L);
            inOrder.verify(eventRepository).deleteByIdStory(1L);
            inOrder.verify(weatherRuleRepository).deleteByIdStory(1L);
            inOrder.verify(itemEffectRepository).deleteByIdStory(1L);
            inOrder.verify(itemRepository).deleteByIdStory(1L);
            inOrder.verify(locationNeighborRepository).deleteByIdStory(1L);
            inOrder.verify(locationRepository).deleteByIdStory(1L);
            inOrder.verify(characterTemplateRepository).deleteByIdStory(1L);
            inOrder.verify(traitRepository).deleteByIdStory(1L);
            inOrder.verify(classBonusRepository).deleteByIdStory(1L);
            inOrder.verify(classRepository).deleteByIdStory(1L);
            inOrder.verify(keyRepository).deleteByIdStory(1L);
            inOrder.verify(cardRepository).deleteByIdStory(1L);
            inOrder.verify(creatorRepository).deleteByIdStory(1L);
            inOrder.verify(textRepository).deleteByIdStory(1L);
            inOrder.verify(difficultyRepository).deleteByIdStory(1L);
            inOrder.verify(storyRepository).deleteById(1L);
        }
        
        @Test void saveDeleteLocation() {
            adapter.saveLocation(new LocationEntity()); verify(locationRepository).save(any());
            adapter.deleteLocationByUuid("u"); verify(locationRepository).deleteByUuid("u");
        }
        @Test void saveDeleteEvent() {
            adapter.saveEvent(new EventEntity()); verify(eventRepository).save(any());
            adapter.deleteEventByUuid("u"); verify(eventRepository).deleteByUuid("u");
        }
        @Test void saveDeleteItem() {
            adapter.saveItem(new ItemEntity()); verify(itemRepository).save(any());
            adapter.deleteItemByUuid("u"); verify(itemRepository).deleteByUuid("u");
        }
        @Test void saveDeleteDifficulty() {
            adapter.saveDifficulty(new StoryDifficultyEntity()); verify(difficultyRepository).save(any());
            adapter.deleteDifficultyByUuid("u"); verify(difficultyRepository).deleteByUuid("u");
        }
        @Test void saveDeleteCharacterTemplate() {
            adapter.saveCharacterTemplate(new CharacterTemplateEntity()); verify(characterTemplateRepository).save(any());
            adapter.deleteCharacterTemplateByUuid("u"); verify(characterTemplateRepository).deleteByUuid("u");
        }
        @Test void saveDeleteClass() {
            adapter.saveClass(new ClassEntity()); verify(classRepository).save(any());
            adapter.deleteClassByUuid("u"); verify(classRepository).deleteByUuid("u");
        }
        @Test void saveDeleteTrait() {
            adapter.saveTrait(new TraitEntity()); verify(traitRepository).save(any());
            adapter.deleteTraitByUuid("u"); verify(traitRepository).deleteByUuid("u");
        }
        @Test void saveDeleteText() {
            adapter.saveText(new TextEntity()); verify(textRepository).save(any());
            adapter.deleteTextByUuid("u"); verify(textRepository).deleteByUuid("u");
        }
        @Test void saveDeleteCard() {
            adapter.saveCard(new CardEntity()); verify(cardRepository).save(any());
            adapter.deleteCardByUuid("u"); verify(cardRepository).deleteByUuid("u");
        }
        @Test void saveDeleteCreator() {
            adapter.saveCreator(new CreatorEntity()); verify(creatorRepository).save(any());
            adapter.deleteCreatorByUuid("u"); verify(creatorRepository).deleteByUuid("u");
        }
        @Test void saveDeleteLocationNeighbor() {
            adapter.saveLocationNeighbor(new LocationNeighborEntity()); verify(locationNeighborRepository).save(any());
            adapter.deleteLocationNeighborByUuid("u"); verify(locationNeighborRepository).deleteByUuid("u");
        }
        @Test void saveDeleteKey() {
            adapter.saveKey(new KeyEntity()); verify(keyRepository).save(any());
            adapter.deleteKeyByUuid("u"); verify(keyRepository).deleteByUuid("u");
        }
        @Test void saveDeleteEventEffect() {
            adapter.saveEventEffect(new EventEffectEntity()); verify(eventEffectRepository).save(any());
            adapter.deleteEventEffectByUuid("u"); verify(eventEffectRepository).deleteByUuid("u");
        }
        @Test void saveDeleteChoice() {
            adapter.saveChoice(new ChoiceEntity()); verify(choiceRepository).save(any());
            adapter.deleteChoiceByUuid("u"); verify(choiceRepository).deleteByUuid("u");
        }
        @Test void saveDeleteChoiceCondition() {
            adapter.saveChoiceCondition(new ChoiceConditionEntity()); verify(choiceConditionRepository).save(any());
            adapter.deleteChoiceConditionByUuid("u"); verify(choiceConditionRepository).deleteByUuid("u");
        }
        @Test void saveDeleteChoiceEffect() {
            adapter.saveChoiceEffect(new ChoiceEffectEntity()); verify(choiceEffectRepository).save(any());
            adapter.deleteChoiceEffectByUuid("u"); verify(choiceEffectRepository).deleteByUuid("u");
        }
        @Test void saveDeleteItemEffect() {
            adapter.saveItemEffect(new ItemEffectEntity()); verify(itemEffectRepository).save(any());
            adapter.deleteItemEffectByUuid("u"); verify(itemEffectRepository).deleteByUuid("u");
        }
        @Test void saveDeleteWeatherRule() {
            adapter.saveWeatherRule(new WeatherRuleEntity()); verify(weatherRuleRepository).save(any());
            adapter.deleteWeatherRuleByUuid("u"); verify(weatherRuleRepository).deleteByUuid("u");
        }
        @Test void saveDeleteGlobalRandomEvent() {
            adapter.saveGlobalRandomEvent(new GlobalRandomEventEntity()); verify(globalRandomEventRepository).save(any());
            adapter.deleteGlobalRandomEventByUuid("u"); verify(globalRandomEventRepository).deleteByUuid("u");
        }
        @Test void saveDeleteClassBonus() {
            adapter.saveClassBonus(new ClassBonusEntity()); verify(classBonusRepository).save(any());
            adapter.deleteClassBonusByUuid("u"); verify(classBonusRepository).deleteByUuid("u");
        }
        @Test void saveDeleteMission() {
            adapter.saveMission(new MissionEntity()); verify(missionRepository).save(any());
            adapter.deleteMissionByUuid("u"); verify(missionRepository).deleteByUuid("u");
        }
        @Test void saveDeleteMissionStep() {
            adapter.saveMissionStep(new MissionStepEntity()); verify(missionStepRepository).save(any());
            adapter.deleteMissionStepByUuid("u"); verify(missionStepRepository).deleteByUuid("u");
        }
    }
}
