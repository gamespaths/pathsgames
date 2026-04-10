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

    public StoryReadAdapter(
            StoryRepository storyRepository,
            StoryDifficultyRepository difficultyRepository,
            TextRepository textRepository,
            LocationRepository locationRepository,
            EventRepository eventRepository,
            ItemRepository itemRepository) {
        this.storyRepository = storyRepository;
        this.difficultyRepository = difficultyRepository;
        this.textRepository = textRepository;
        this.locationRepository = locationRepository;
        this.eventRepository = eventRepository;
        this.itemRepository = itemRepository;
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
}
