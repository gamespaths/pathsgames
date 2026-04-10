package games.paths.core.persistence.story;

import games.paths.core.entity.story.*;
import games.paths.core.port.story.StoryPersistencePort;
import games.paths.core.repository.story.*;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

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

    public StoryPersistenceAdapter(
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
            MissionStepRepository missionStepRepository) {
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
    }

    @Override
    public StoryEntity saveStory(StoryEntity entity) {
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
    public List<TextEntity> saveTexts(List<TextEntity> texts) {
        return textRepository.saveAll(texts);
    }

    @Override
    public List<StoryDifficultyEntity> saveDifficulties(List<StoryDifficultyEntity> difficulties) {
        return difficultyRepository.saveAll(difficulties);
    }

    @Override
    public List<CreatorEntity> saveCreators(List<CreatorEntity> creators) {
        return creatorRepository.saveAll(creators);
    }

    @Override
    public List<CardEntity> saveCards(List<CardEntity> cards) {
        return cardRepository.saveAll(cards);
    }

    @Override
    public List<KeyEntity> saveKeys(List<KeyEntity> keys) {
        return keyRepository.saveAll(keys);
    }

    @Override
    public List<ClassEntity> saveClasses(List<ClassEntity> classes) {
        return classRepository.saveAll(classes);
    }

    @Override
    public List<ClassBonusEntity> saveClassBonuses(List<ClassBonusEntity> bonuses) {
        return classBonusRepository.saveAll(bonuses);
    }

    @Override
    public List<TraitEntity> saveTraits(List<TraitEntity> traits) {
        return traitRepository.saveAll(traits);
    }

    @Override
    public List<CharacterTemplateEntity> saveCharacterTemplates(List<CharacterTemplateEntity> templates) {
        return characterTemplateRepository.saveAll(templates);
    }

    @Override
    public List<LocationEntity> saveLocations(List<LocationEntity> locations) {
        return locationRepository.saveAll(locations);
    }

    @Override
    public List<LocationNeighborEntity> saveLocationNeighbors(List<LocationNeighborEntity> neighbors) {
        return locationNeighborRepository.saveAll(neighbors);
    }

    @Override
    public List<ItemEntity> saveItems(List<ItemEntity> items) {
        return itemRepository.saveAll(items);
    }

    @Override
    public List<ItemEffectEntity> saveItemEffects(List<ItemEffectEntity> effects) {
        return itemEffectRepository.saveAll(effects);
    }

    @Override
    public List<WeatherRuleEntity> saveWeatherRules(List<WeatherRuleEntity> rules) {
        return weatherRuleRepository.saveAll(rules);
    }

    @Override
    public List<EventEntity> saveEvents(List<EventEntity> events) {
        return eventRepository.saveAll(events);
    }

    @Override
    public List<EventEffectEntity> saveEventEffects(List<EventEffectEntity> effects) {
        return eventEffectRepository.saveAll(effects);
    }

    @Override
    public List<ChoiceEntity> saveChoices(List<ChoiceEntity> choices) {
        return choiceRepository.saveAll(choices);
    }

    @Override
    public List<ChoiceConditionEntity> saveChoiceConditions(List<ChoiceConditionEntity> conditions) {
        return choiceConditionRepository.saveAll(conditions);
    }

    @Override
    public List<ChoiceEffectEntity> saveChoiceEffects(List<ChoiceEffectEntity> effects) {
        return choiceEffectRepository.saveAll(effects);
    }

    @Override
    public List<GlobalRandomEventEntity> saveGlobalRandomEvents(List<GlobalRandomEventEntity> events) {
        return globalRandomEventRepository.saveAll(events);
    }

    @Override
    public List<MissionEntity> saveMissions(List<MissionEntity> missions) {
        return missionRepository.saveAll(missions);
    }

    @Override
    public List<MissionStepEntity> saveMissionSteps(List<MissionStepEntity> steps) {
        return missionStepRepository.saveAll(steps);
    }
}
