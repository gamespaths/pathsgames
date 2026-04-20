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
    private final EventRepository eventRepository;
    private final ItemRepository itemRepository;
    private final CharacterTemplateRepository characterTemplateRepository;
    private final ClassRepository classRepository;
    private final TraitRepository traitRepository;
    private final CardRepository cardRepository;
    private final CreatorRepository creatorRepository;

    public StoryReadAdapter(
            StoryRepository storyRepository,
            StoryDifficultyRepository difficultyRepository,
            TextRepository textRepository,
            LocationRepository locationRepository,
            EventRepository eventRepository,
            ItemRepository itemRepository,
            CharacterTemplateRepository characterTemplateRepository,
            ClassRepository classRepository,
            TraitRepository traitRepository,
            CardRepository cardRepository,
            CreatorRepository creatorRepository) {
        this.storyRepository = storyRepository;
        this.difficultyRepository = difficultyRepository;
        this.textRepository = textRepository;
        this.locationRepository = locationRepository;
        this.eventRepository = eventRepository;
        this.itemRepository = itemRepository;
        this.characterTemplateRepository = characterTemplateRepository;
        this.classRepository = classRepository;
        this.traitRepository = traitRepository;
        this.cardRepository = cardRepository;
        this.creatorRepository = creatorRepository;
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
}
