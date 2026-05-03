package games.paths.core.persistence.story;

import games.paths.core.entity.story.*;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.repository.story.*;
import jakarta.persistence.EntityManager;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Optional;

/**
 * StoryPersistenceAdapter - Database adapter for story write operations.
 * Uses Spring Data JPA repositories for all persistence.
 * Handles cascading deletes across all story sub-tables.
 */
@Repository
@Transactional
public class StoryPersistenceAdapter implements StoryPersistencePort {

    private final EntityManager entityManager;

    private final StoryRepository storyRepository;
    private final TextRepository textRepository;
    private final StoryDifficultyRepository difficultyRepository;
    private final CreatorRepository creatorRepository;
    private final CardRepository cardRepository;
    private final KeyRepository keyRepository;
    private final ClassRepository classRepository;
    private final ClassBonusRepository classBonusRepository;
    private final TraitRepository traitRepository;
    private final CharacterTemplateRepository characterTemplateRepository;
    private final LocationRepository locationRepository;
    private final LocationNeighborRepository locationNeighborRepository;
    private final ItemRepository itemRepository;
    private final ItemEffectRepository itemEffectRepository;
    private final WeatherRuleRepository weatherRuleRepository;
    private final EventRepository eventRepository;
    private final EventEffectRepository eventEffectRepository;
    private final ChoiceRepository choiceRepository;
    private final ChoiceConditionRepository choiceConditionRepository;
    private final ChoiceEffectRepository choiceEffectRepository;
    private final GlobalRandomEventRepository globalRandomEventRepository;
    private final MissionRepository missionRepository;
    private final MissionStepRepository missionStepRepository;
    private final JdbcTemplate jdbcTemplate;

    public StoryPersistenceAdapter(
            EntityManager entityManager,
            StoryRepository storyRepository,
            TextRepository textRepository,
            StoryDifficultyRepository difficultyRepository,
            CreatorRepository creatorRepository,
            CardRepository cardRepository,
            KeyRepository keyRepository,
            ClassRepository classRepository,
            ClassBonusRepository classBonusRepository,
            TraitRepository traitRepository,
            CharacterTemplateRepository characterTemplateRepository,
            LocationRepository locationRepository,
            LocationNeighborRepository locationNeighborRepository,
            ItemRepository itemRepository,
            ItemEffectRepository itemEffectRepository,
            WeatherRuleRepository weatherRuleRepository,
            EventRepository eventRepository,
            EventEffectRepository eventEffectRepository,
            ChoiceRepository choiceRepository,
            ChoiceConditionRepository choiceConditionRepository,
            ChoiceEffectRepository choiceEffectRepository,
            GlobalRandomEventRepository globalRandomEventRepository,
            MissionRepository missionRepository,
            MissionStepRepository missionStepRepository,
            JdbcTemplate jdbcTemplate) {
        this.entityManager = entityManager;
        this.storyRepository = storyRepository;
        this.textRepository = textRepository;
        this.difficultyRepository = difficultyRepository;
        this.creatorRepository = creatorRepository;
        this.cardRepository = cardRepository;
        this.keyRepository = keyRepository;
        this.classRepository = classRepository;
        this.classBonusRepository = classBonusRepository;
        this.traitRepository = traitRepository;
        this.characterTemplateRepository = characterTemplateRepository;
        this.locationRepository = locationRepository;
        this.locationNeighborRepository = locationNeighborRepository;
        this.itemRepository = itemRepository;
        this.itemEffectRepository = itemEffectRepository;
        this.weatherRuleRepository = weatherRuleRepository;
        this.eventRepository = eventRepository;
        this.eventEffectRepository = eventEffectRepository;
        this.choiceRepository = choiceRepository;
        this.choiceConditionRepository = choiceConditionRepository;
        this.choiceEffectRepository = choiceEffectRepository;
        this.globalRandomEventRepository = globalRandomEventRepository;
        this.missionRepository = missionRepository;
        this.missionStepRepository = missionStepRepository;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public StoryEntity saveStory(StoryEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextGlobalId("list_stories", "id"));
        }
        if (!storyRepository.existsById(entity.getId())) {
            entityManager.persist(entity);
            entityManager.flush();
            return entity;
        }
        return storyRepository.save(entity);
    }

    @Override
    public void deleteStoryData(Long storyId) {
        // Delete in reverse dependency order to avoid FK violations
        missionStepRepository.deleteByIdStory(storyId);
        missionRepository.deleteByIdStory(storyId);
        globalRandomEventRepository.deleteByIdStory(storyId);
        choiceEffectRepository.deleteByIdStory(storyId);
        choiceConditionRepository.deleteByIdStory(storyId);
        choiceRepository.deleteByIdStory(storyId);
        eventEffectRepository.deleteByIdStory(storyId);
        eventRepository.deleteByIdStory(storyId);
        weatherRuleRepository.deleteByIdStory(storyId);
        itemEffectRepository.deleteByIdStory(storyId);
        itemRepository.deleteByIdStory(storyId);
        locationNeighborRepository.deleteByIdStory(storyId);
        locationRepository.deleteByIdStory(storyId);
        characterTemplateRepository.deleteByIdStory(storyId);
        traitRepository.deleteByIdStory(storyId);
        classBonusRepository.deleteByIdStory(storyId);
        classRepository.deleteByIdStory(storyId);
        keyRepository.deleteByIdStory(storyId);
        cardRepository.deleteByIdStory(storyId);
        creatorRepository.deleteByIdStory(storyId);
        textRepository.deleteByIdStory(storyId);
        difficultyRepository.deleteByIdStory(storyId);
        storyRepository.deleteById(storyId);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<StoryEntity> findStoryByUuid(String uuid) {
        return storyRepository.findByUuid(uuid);
    }

    @Override
    public boolean existsStoryId(Long id) {
        return id != null && storyRepository.existsById(id);
    }

    @Override
    public boolean existsTextId(Long id, Long idStory) {
        return existsByStoryScope("list_texts", "id", id, idStory);
    }

    @Override
    public boolean existsDifficultyId(Long id, Long idStory) {
        return existsByStoryScope("list_stories_difficulty", "id", id, idStory);
    }

    @Override
    public boolean existsCreatorId(Long id, Long idStory) {
        return existsByStoryScope("list_creator", "id", id, idStory);
    }

    @Override
    public boolean existsCardId(Long id, Long idStory) {
        return existsByStoryScope("list_cards", "id", id, idStory);
    }

    @Override
    public boolean existsKeyId(Long id, Long idStory) {
        return existsByStoryScope("list_keys", "id", id, idStory);
    }

    @Override
    public boolean existsClassId(Long id, Long idStory) {
        return existsByStoryScope("list_classes", "id", id, idStory);
    }

    @Override
    public boolean existsTraitId(Long id, Long idStory) {
        return existsByStoryScope("list_traits", "id", id, idStory);
    }

    @Override
    public boolean existsCharacterTemplateId(Long id, Long idStory) {
        return existsByStoryScope("list_character_templates", "id_tipo", id, idStory);
    }

    @Override
    public boolean existsLocationId(Long id, Long idStory) {
        return existsByStoryScope("list_locations", "id", id, idStory);
    }

    @Override
    public boolean existsEventId(Long id, Long idStory) {
        return existsByStoryScope("list_events", "id", id, idStory);
    }

    @Override
    public boolean existsItemId(Long id, Long idStory) {
        return existsByStoryScope("list_items", "id", id, idStory);
    }

    @Override
    public boolean existsChoiceId(Long id, Long idStory) {
        return existsByStoryScope("list_choices", "id", id, idStory);
    }

    @Override
    public boolean existsWeatherRuleId(Long id, Long idStory) {
        return existsByStoryScope("list_weather_rules", "id", id, idStory);
    }

    @Override
    public boolean existsGlobalRandomEventId(Long id, Long idStory) {
        return existsByStoryScope("list_global_random_events", "id", id, idStory);
    }

    @Override
    public boolean existsMissionId(Long id, Long idStory) {
        return existsByStoryScope("list_missions", "id", id, idStory);
    }
    
    @Override
    public boolean existsLocationNeighborId(Long id, Long idStory) {
        return existsByStoryScope("list_locations_neighbors", "id", id, idStory);
    }

    @Override
    public boolean existsEventEffectId(Long id, Long idStory) {
        return existsByStoryScope("list_events_effects", "id", id, idStory);
    }

    @Override
    public boolean existsItemEffectId(Long id, Long idStory) {
        return existsByStoryScope("list_items_effects", "id", id, idStory);
    }

    @Override
    public boolean existsChoiceConditionId(Long id, Long idStory) {
        return existsByStoryScope("list_choices_conditions", "id", id, idStory);
    }

    @Override
    public boolean existsChoiceEffectId(Long id, Long idStory) {
        return existsByStoryScope("list_choices_effects", "id", id, idStory);
    }

    @Override
    public boolean existsClassBonusId(Long id, Long idStory) {
        return existsByStoryScope("list_classes_bonus", "id", id, idStory);
    }

    @Override
    public boolean existsMissionStepId(Long id, Long idStory) {
        return existsByStoryScope("list_missions_steps", "id", id, idStory);
    }

    @Override
    public Long nextStoryScopedId(String tableName, String idColumn, Long idStory) {
        if (idStory == null || tableName == null || idColumn == null) {
            return null;
        }
        if (!tableName.matches("[a-zA-Z0-9_]+") || !idColumn.matches("[a-zA-Z0-9_]+")) {
            throw new IllegalArgumentException("Invalid scoped id selector");
        }
        String sql = "SELECT COALESCE(MAX(" + idColumn + "), 0) + 1 FROM " + tableName + " WHERE id_story = ?";
        Long next = jdbcTemplate.queryForObject(sql, Long.class, idStory);
        return next != null ? next : 1L;
    }

    private boolean existsByStoryScope(String tableName, String idColumn, Long id, Long idStory) {
        if (id == null || idStory == null) {
            return false;
        }
        String sql = "SELECT COUNT(1) FROM " + tableName + " WHERE " + idColumn + " = ? AND id_story = ?";
        Integer count = jdbcTemplate.queryForObject(sql, Integer.class, id, idStory);
        return count != null && count > 0;
    }

    @Override
    public Long nextGlobalId(String tableName, String idColumn) {
        String sql = "SELECT COALESCE(MAX(" + idColumn + "), 0) + 1 FROM " + tableName;
        Long next = jdbcTemplate.queryForObject(sql, Long.class);
        return next == null ? 1L : next;
    }

    @Override
    public void syncStorySequences() {
        syncSequence("list_stories", "id");
        syncSequence("list_texts", "id");
        syncSequence("list_stories_difficulty", "id");
        syncSequence("list_creator", "id");
        syncSequence("list_cards", "id");
        syncSequence("list_keys", "id");
        syncSequence("list_classes", "id");
        syncSequence("list_traits", "id");
        syncSequence("list_character_templates", "id_tipo");
        syncSequence("list_locations", "id");
        syncSequence("list_events", "id");
        syncSequence("list_items", "id");
        syncSequence("list_choices", "id");
        syncSequence("list_weather_rules", "id");
        syncSequence("list_global_random_events", "id");
        syncSequence("list_missions", "id");
        syncSequence("list_locations_neighbors", "id");
        syncSequence("list_events_effects", "id");
        syncSequence("list_items_effects", "id");
        syncSequence("list_choices_conditions", "id");
        syncSequence("list_choices_effects", "id");
        syncSequence("list_classes_bonus", "id");
        syncSequence("list_missions_steps", "id");
    }

    private void syncSequence(String tableName, String idColumn) {
        try {
            String sql = "SELECT setval(pg_get_serial_sequence('" + tableName + "', '" + idColumn + "'), "
                    + "COALESCE((SELECT MAX(" + idColumn + ") FROM " + tableName + "), 1), true)";
            jdbcTemplate.queryForObject(sql, Long.class);
        } catch (Exception ignored) {
            // Non-PostgreSQL database or sequence unavailable.
        }
    }

    @Override
    public List<TextEntity> saveTexts(List<TextEntity> texts) {
        return persistAll(texts);
    }

    @Override
    public List<StoryDifficultyEntity> saveDifficulties(List<StoryDifficultyEntity> difficulties) {
        return persistAll(difficulties);
    }

    @Override
    public List<CreatorEntity> saveCreators(List<CreatorEntity> creators) {
        return persistAll(creators);
    }

    @Override
    public List<CardEntity> saveCards(List<CardEntity> cards) {
        return persistAll(cards);
    }

    @Override
    public List<KeyEntity> saveKeys(List<KeyEntity> keys) {
        return persistAll(keys);
    }

    @Override
    public List<ClassEntity> saveClasses(List<ClassEntity> classes) {
        return persistAll(classes);
    }

    @Override
    public List<ClassBonusEntity> saveClassBonuses(List<ClassBonusEntity> bonuses) {
        return persistAll(bonuses);
    }

    @Override
    public List<TraitEntity> saveTraits(List<TraitEntity> traits) {
        return persistAll(traits);
    }

    @Override
    public List<CharacterTemplateEntity> saveCharacterTemplates(List<CharacterTemplateEntity> templates) {
        return persistAll(templates);
    }

    @Override
    public List<LocationEntity> saveLocations(List<LocationEntity> locations) {
        return persistAll(locations);
    }

    @Override
    public List<LocationNeighborEntity> saveLocationNeighbors(List<LocationNeighborEntity> neighbors) {
        return persistAll(neighbors);
    }

    @Override
    public List<ItemEntity> saveItems(List<ItemEntity> items) {
        return persistAll(items);
    }

    @Override
    public List<ItemEffectEntity> saveItemEffects(List<ItemEffectEntity> effects) {
        return persistAll(effects);
    }

    @Override
    public List<WeatherRuleEntity> saveWeatherRules(List<WeatherRuleEntity> rules) {
        return persistAll(rules);
    }

    @Override
    public List<EventEntity> saveEvents(List<EventEntity> events) {
        return persistAll(events);
    }

    @Override
    public List<EventEffectEntity> saveEventEffects(List<EventEffectEntity> effects) {
        return persistAll(effects);
    }

    @Override
    public List<ChoiceEntity> saveChoices(List<ChoiceEntity> choices) {
        return persistAll(choices);
    }

    @Override
    public List<ChoiceConditionEntity> saveChoiceConditions(List<ChoiceConditionEntity> conditions) {
        return persistAll(conditions);
    }

    @Override
    public List<ChoiceEffectEntity> saveChoiceEffects(List<ChoiceEffectEntity> effects) {
        return persistAll(effects);
    }

    @Override
    public List<GlobalRandomEventEntity> saveGlobalRandomEvents(List<GlobalRandomEventEntity> events) {
        return persistAll(events);
    }

    @Override
    public List<MissionEntity> saveMissions(List<MissionEntity> missions) {
        return persistAll(missions);
    }

    @Override
    public List<MissionStepEntity> saveMissionSteps(List<MissionStepEntity> steps) {
        return persistAll(steps);
    }

    private <T> List<T> persistAll(List<T> entities) {
        if (entities == null || entities.isEmpty()) {
            return entities;
        }
        for (T entity : entities) {
            entityManager.persist(entity);
        }
        entityManager.flush();
        return entities;
    }

    // === Step 17: Individual entity save/delete for CRUD ===

    @Override
    public LocationEntity saveLocation(LocationEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_locations", "id", entity.getIdStory()));
        }
        return locationRepository.save(entity);
    }

    @Override
    public EventEntity saveEvent(EventEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_events", "id", entity.getIdStory()));
        }
        return eventRepository.save(entity);
    }

    @Override
    public ItemEntity saveItem(ItemEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_items", "id", entity.getIdStory()));
        }
        return itemRepository.save(entity);
    }

    @Override
    public StoryDifficultyEntity saveDifficulty(StoryDifficultyEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_stories_difficulty", "id", entity.getIdStory()));
        }
        return difficultyRepository.save(entity);
    }

    @Override
    public CharacterTemplateEntity saveCharacterTemplate(CharacterTemplateEntity entity) {
        if (entity.getIdTipo() == null) {
            entity.setIdTipo(nextStoryScopedId("list_character_templates", "id_tipo", entity.getIdStory()));
        }
        return characterTemplateRepository.save(entity);
    }

    @Override
    public ClassEntity saveClass(ClassEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_classes", "id", entity.getIdStory()));
        }
        return classRepository.save(entity);
    }

    @Override
    public TraitEntity saveTrait(TraitEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_traits", "id", entity.getIdStory()));
        }
        return traitRepository.save(entity);
    }

    @Override
    public TextEntity saveText(TextEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_texts", "id", entity.getIdStory()));
        }
        return textRepository.save(entity);
    }

    @Override
    public CardEntity saveCard(CardEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_cards", "id", entity.getIdStory()));
        }
        return cardRepository.save(entity);
    }

    @Override
    public CreatorEntity saveCreator(CreatorEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_creator", "id", entity.getIdStory()));
        }
        return creatorRepository.save(entity);
    }

    @Override
    public void deleteLocationByUuid(String uuid) { locationRepository.deleteByUuid(uuid); }

    @Override
    public void deleteEventByUuid(String uuid) { eventRepository.deleteByUuid(uuid); }

    @Override
    public void deleteItemByUuid(String uuid) { itemRepository.deleteByUuid(uuid); }

    @Override
    public void deleteDifficultyByUuid(String uuid) { difficultyRepository.deleteByUuid(uuid); }

    @Override
    public void deleteCharacterTemplateByUuid(String uuid) { characterTemplateRepository.deleteByUuid(uuid); }

    @Override
    public void deleteClassByUuid(String uuid) { classRepository.deleteByUuid(uuid); }

    @Override
    public void deleteTraitByUuid(String uuid) { traitRepository.deleteByUuid(uuid); }

    @Override
    public void deleteTextByUuid(String uuid) { textRepository.deleteByUuid(uuid); }

    @Override
    public void deleteCardByUuid(String uuid) { cardRepository.deleteByUuid(uuid); }

    @Override
    public void deleteCreatorByUuid(String uuid) { creatorRepository.deleteByUuid(uuid); }

    // === Step 17: 12 new entity type save/delete ===

    @Override
    public LocationNeighborEntity saveLocationNeighbor(LocationNeighborEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_locations_neighbors", "id", entity.getIdStory()));
        }
        return locationNeighborRepository.save(entity);
    }
    @Override
    public void deleteLocationNeighborByUuid(String uuid) { locationNeighborRepository.deleteByUuid(uuid); }

    @Override
    public KeyEntity saveKey(KeyEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_keys", "id", entity.getIdStory()));
        }
        return keyRepository.save(entity);
    }
    @Override
    public void deleteKeyByUuid(String uuid) { keyRepository.deleteByUuid(uuid); }

    @Override
    public EventEffectEntity saveEventEffect(EventEffectEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_events_effects", "id", entity.getIdStory()));
        }
        return eventEffectRepository.save(entity);
    }
    @Override
    public void deleteEventEffectByUuid(String uuid) { eventEffectRepository.deleteByUuid(uuid); }

    @Override
    public ChoiceEntity saveChoice(ChoiceEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_choices", "id", entity.getIdStory()));
        }
        return choiceRepository.save(entity);
    }
    @Override
    public void deleteChoiceByUuid(String uuid) { choiceRepository.deleteByUuid(uuid); }

    @Override
    public ChoiceConditionEntity saveChoiceCondition(ChoiceConditionEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_choices_conditions", "id", entity.getIdStory()));
        }
        return choiceConditionRepository.save(entity);
    }
    @Override
    public void deleteChoiceConditionByUuid(String uuid) { choiceConditionRepository.deleteByUuid(uuid); }

    @Override
    public ChoiceEffectEntity saveChoiceEffect(ChoiceEffectEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_choices_effects", "id", entity.getIdStory()));
        }
        return choiceEffectRepository.save(entity);
    }
    @Override
    public void deleteChoiceEffectByUuid(String uuid) { choiceEffectRepository.deleteByUuid(uuid); }

    @Override
    public ItemEffectEntity saveItemEffect(ItemEffectEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_items_effects", "id", entity.getIdStory()));
        }
        return itemEffectRepository.save(entity);
    }
    @Override
    public void deleteItemEffectByUuid(String uuid) { itemEffectRepository.deleteByUuid(uuid); }

    @Override
    public WeatherRuleEntity saveWeatherRule(WeatherRuleEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_weather_rules", "id", entity.getIdStory()));
        }
        return weatherRuleRepository.save(entity);
    }
    @Override
    public void deleteWeatherRuleByUuid(String uuid) { weatherRuleRepository.deleteByUuid(uuid); }

    @Override
    public GlobalRandomEventEntity saveGlobalRandomEvent(GlobalRandomEventEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_global_random_events", "id", entity.getIdStory()));
        }
        return globalRandomEventRepository.save(entity);
    }
    @Override
    public void deleteGlobalRandomEventByUuid(String uuid) { globalRandomEventRepository.deleteByUuid(uuid); }

    @Override
    public ClassBonusEntity saveClassBonus(ClassBonusEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_classes_bonus", "id", entity.getIdStory()));
        }
        return classBonusRepository.save(entity);
    }
    @Override
    public void deleteClassBonusByUuid(String uuid) { classBonusRepository.deleteByUuid(uuid); }

    @Override
    public MissionEntity saveMission(MissionEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_missions", "id", entity.getIdStory()));
        }
        return missionRepository.save(entity);
    }
    @Override
    public void deleteMissionByUuid(String uuid) { missionRepository.deleteByUuid(uuid); }

    @Override
    public MissionStepEntity saveMissionStep(MissionStepEntity entity) {
        if (entity.getId() == null) {
            entity.setId(nextStoryScopedId("list_missions_steps", "id", entity.getIdStory()));
        }
        return missionStepRepository.save(entity);
    }
    @Override
    public void deleteMissionStepByUuid(String uuid) { missionStepRepository.deleteByUuid(uuid); }
}
