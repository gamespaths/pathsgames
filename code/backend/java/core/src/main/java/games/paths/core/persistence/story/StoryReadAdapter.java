package games.paths.core.persistence.story;

import games.paths.core.entity.story.*;
import games.paths.core.port.story.StoryReadPort;
import games.paths.core.repository.story.*;

import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * StoryReadAdapter - Database adapter for story read operations.
 * Uses Spring Data JPA repositories for all persistence reads.
 *
 * <p>Enhanced in Step 15 with category/group listing, filtering,
 * and entity retrieval for character templates, classes, traits, and cards.</p>
 *
 * <p>Enhanced in Step 16 with card/creator lookup by UUID.</p>
 */
@Repository
@Transactional(readOnly = true)
public class StoryReadAdapter implements StoryReadPort {

    private final StoryRepository storyRepository;
    private final StoryDifficultyRepository difficultyRepository;
    private final TextRepository textRepository;
    private final LocationRepository locationRepository;
    private final LocationNeighborRepository locationNeighborRepository;
    private final EventRepository eventRepository;
    private final EventEffectRepository eventEffectRepository;
    private final ItemRepository itemRepository;
    private final ItemEffectRepository itemEffectRepository;
    private final CharacterTemplateRepository characterTemplateRepository;
    private final ClassRepository classRepository;
    private final ClassBonusRepository classBonusRepository;
    private final TraitRepository traitRepository;
    private final CardRepository cardRepository;
    private final CreatorRepository creatorRepository;
    private final KeyRepository keyRepository;
    private final ChoiceRepository choiceRepository;
    private final ChoiceConditionRepository choiceConditionRepository;
    private final ChoiceEffectRepository choiceEffectRepository;
    private final WeatherRuleRepository weatherRuleRepository;
    private final GlobalRandomEventRepository globalRandomEventRepository;
    private final MissionRepository missionRepository;
    private final MissionStepRepository missionStepRepository;

    public StoryReadAdapter(
            StoryRepository storyRepository,
            StoryDifficultyRepository difficultyRepository,
            TextRepository textRepository,
            LocationRepository locationRepository,
            LocationNeighborRepository locationNeighborRepository,
            EventRepository eventRepository,
            EventEffectRepository eventEffectRepository,
            ItemRepository itemRepository,
            ItemEffectRepository itemEffectRepository,
            CharacterTemplateRepository characterTemplateRepository,
            ClassRepository classRepository,
            ClassBonusRepository classBonusRepository,
            TraitRepository traitRepository,
            CardRepository cardRepository,
            CreatorRepository creatorRepository,
            KeyRepository keyRepository,
            ChoiceRepository choiceRepository,
            ChoiceConditionRepository choiceConditionRepository,
            ChoiceEffectRepository choiceEffectRepository,
            WeatherRuleRepository weatherRuleRepository,
            GlobalRandomEventRepository globalRandomEventRepository,
            MissionRepository missionRepository,
            MissionStepRepository missionStepRepository) {
        this.storyRepository = storyRepository;
        this.difficultyRepository = difficultyRepository;
        this.textRepository = textRepository;
        this.locationRepository = locationRepository;
        this.locationNeighborRepository = locationNeighborRepository;
        this.eventRepository = eventRepository;
        this.eventEffectRepository = eventEffectRepository;
        this.itemRepository = itemRepository;
        this.itemEffectRepository = itemEffectRepository;
        this.characterTemplateRepository = characterTemplateRepository;
        this.classRepository = classRepository;
        this.classBonusRepository = classBonusRepository;
        this.traitRepository = traitRepository;
        this.cardRepository = cardRepository;
        this.creatorRepository = creatorRepository;
        this.keyRepository = keyRepository;
        this.choiceRepository = choiceRepository;
        this.choiceConditionRepository = choiceConditionRepository;
        this.choiceEffectRepository = choiceEffectRepository;
        this.weatherRuleRepository = weatherRuleRepository;
        this.globalRandomEventRepository = globalRandomEventRepository;
        this.missionRepository = missionRepository;
        this.missionStepRepository = missionStepRepository;
    }

    @Override
    public List<StoryEntity> findStoriesByVisibility(String visibility) {
        return storyRepository.findByVisibilityOrderByPriorityDesc(visibility);
    }

    @Override
    public List<StoryEntity> findAllStories() {
        return storyRepository.findAll();
    }

    @Override
    public Optional<StoryEntity> findStoryByUuid(String uuid) {
        return storyRepository.findByUuid(uuid);
    }

    @Override
    public List<StoryDifficultyEntity> findDifficultiesByStoryId(Long storyId) {
        return difficultyRepository.findByIdStory(storyId);
    }

    @Override
    public List<TextEntity> findTextsByStoryAndIdText(Long storyId, Integer idText) {
        return textRepository.findByIdStoryAndIdText(storyId, idText);
    }

    @Override
    public Optional<TextEntity> findTextByStoryIdTextAndLang(Long storyId, Integer idText, String lang) {
        List<TextEntity> results = textRepository.findByIdStoryAndIdTextAndLang(storyId, idText, lang);
        return results.isEmpty() ? Optional.empty() : Optional.of(results.get(0));
    }

    @Override
    public long countLocationsByStoryId(Long storyId) {
        return locationRepository.findByIdStory(storyId).size();
    }

    @Override
    public long countEventsByStoryId(Long storyId) {
        return eventRepository.findByIdStory(storyId).size();
    }

    @Override
    public long countItemsByStoryId(Long storyId) {
        return itemRepository.findByIdStory(storyId).size();
    }

    // === Step 15: Category and Group queries ===

    @Override
    public List<String> findDistinctCategoriesByVisibility(String visibility) {
        return storyRepository.findDistinctCategoriesByVisibility(visibility);
    }

    @Override
    public List<String> findDistinctGroupsByVisibility(String visibility) {
        return storyRepository.findDistinctGroupsByVisibility(visibility);
    }

    @Override
    public List<StoryEntity> findStoriesByCategoryAndVisibility(String category, String visibility) {
        return storyRepository.findByCategoryAndVisibilityOrderByPriorityDesc(category, visibility);
    }

    @Override
    public List<StoryEntity> findStoriesByGroupAndVisibility(String group, String visibility) {
        return storyRepository.findByGroupAndVisibilityOrderByPriorityDesc(group, visibility);
    }

    @Override
    public List<CharacterTemplateEntity> findCharacterTemplatesByStoryId(Long storyId) {
        return characterTemplateRepository.findByIdStory(storyId);
    }

    @Override
    public List<ClassEntity> findClassesByStoryId(Long storyId) {
        return classRepository.findByIdStory(storyId);
    }

    @Override
    public List<TraitEntity> findTraitsByStoryId(Long storyId) {
        return traitRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<CardEntity> findCardByStoryIdAndCardId(Long storyId, Long cardId) {
        return cardRepository.findByIdStoryAndId(storyId, cardId);
    }

    // === Step 16: Card and Creator lookup by UUID ===

    @Override
    public Optional<CardEntity> findCardByStoryIdAndUuid(Long storyId, String uuid) {
        return cardRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public Optional<CreatorEntity> findCreatorByStoryIdAndUuid(Long storyId, String uuid) {
        return creatorRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<CreatorEntity> findCreatorsByStoryId(Long storyId) {
        return creatorRepository.findByIdStory(storyId);
    }

    // === Step 17: CRUD lookup methods ===

    @Override
    public Optional<StoryDifficultyEntity> findDifficultyByStoryIdAndUuid(Long storyId, String uuid) {
        return difficultyRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public Optional<LocationEntity> findLocationByStoryIdAndUuid(Long storyId, String uuid) {
        return locationRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<LocationEntity> findLocationsByStoryId(Long storyId) {
        return locationRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<EventEntity> findEventByStoryIdAndUuid(Long storyId, String uuid) {
        return eventRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<EventEntity> findEventsByStoryId(Long storyId) {
        return eventRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<ItemEntity> findItemByStoryIdAndUuid(Long storyId, String uuid) {
        return itemRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<ItemEntity> findItemsByStoryId(Long storyId) {
        return itemRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<CharacterTemplateEntity> findCharacterTemplateByStoryIdAndUuid(Long storyId, String uuid) {
        return characterTemplateRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public Optional<ClassEntity> findClassByStoryIdAndUuid(Long storyId, String uuid) {
        return classRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public Optional<TraitEntity> findTraitByStoryIdAndUuid(Long storyId, String uuid) {
        return traitRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public Optional<TextEntity> findTextByStoryIdAndUuid(Long storyId, String uuid) {
        return textRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<TextEntity> findTextsByStoryId(Long storyId) {
        return textRepository.findByIdStory(storyId);
    }

    @Override
    public List<CardEntity> findCardsByStoryId(Long storyId) {
        return cardRepository.findByIdStory(storyId);
    }

    // === Step 17: 12 new entity type lookups ===

    @Override
    public Optional<LocationNeighborEntity> findLocationNeighborByStoryIdAndUuid(Long storyId, String uuid) {
        return locationNeighborRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<LocationNeighborEntity> findLocationNeighborsByStoryId(Long storyId) {
        return locationNeighborRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<KeyEntity> findKeyByStoryIdAndUuid(Long storyId, String uuid) {
        return keyRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<KeyEntity> findKeysByStoryId(Long storyId) {
        return keyRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<EventEffectEntity> findEventEffectByStoryIdAndUuid(Long storyId, String uuid) {
        return eventEffectRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<EventEffectEntity> findEventEffectsByStoryId(Long storyId) {
        return eventEffectRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<ChoiceEntity> findChoiceByStoryIdAndUuid(Long storyId, String uuid) {
        return choiceRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<ChoiceEntity> findChoicesByStoryId(Long storyId) {
        return choiceRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<ChoiceConditionEntity> findChoiceConditionByStoryIdAndUuid(Long storyId, String uuid) {
        return choiceConditionRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<ChoiceConditionEntity> findChoiceConditionsByStoryId(Long storyId) {
        return choiceConditionRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<ChoiceEffectEntity> findChoiceEffectByStoryIdAndUuid(Long storyId, String uuid) {
        return choiceEffectRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<ChoiceEffectEntity> findChoiceEffectsByStoryId(Long storyId) {
        return choiceEffectRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<ItemEffectEntity> findItemEffectByStoryIdAndUuid(Long storyId, String uuid) {
        return itemEffectRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<ItemEffectEntity> findItemEffectsByStoryId(Long storyId) {
        return itemEffectRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<WeatherRuleEntity> findWeatherRuleByStoryIdAndUuid(Long storyId, String uuid) {
        return weatherRuleRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<WeatherRuleEntity> findWeatherRulesByStoryId(Long storyId) {
        return weatherRuleRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<GlobalRandomEventEntity> findGlobalRandomEventByStoryIdAndUuid(Long storyId, String uuid) {
        return globalRandomEventRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<GlobalRandomEventEntity> findGlobalRandomEventsByStoryId(Long storyId) {
        return globalRandomEventRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<ClassBonusEntity> findClassBonusByStoryIdAndUuid(Long storyId, String uuid) {
        return classBonusRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<ClassBonusEntity> findClassBonusesByStoryId(Long storyId) {
        return classBonusRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<MissionEntity> findMissionByStoryIdAndUuid(Long storyId, String uuid) {
        return missionRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<MissionEntity> findMissionsByStoryId(Long storyId) {
        return missionRepository.findByIdStory(storyId);
    }

    @Override
    public Optional<MissionStepEntity> findMissionStepByStoryIdAndUuid(Long storyId, String uuid) {
        return missionStepRepository.findByIdStoryAndUuid(storyId, uuid);
    }

    @Override
    public List<MissionStepEntity> findMissionStepsByStoryId(Long storyId) {
        return missionStepRepository.findByIdStory(storyId);
    }
}
