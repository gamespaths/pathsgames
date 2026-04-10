package games.paths.core.persistence.story;

import games.paths.core.entity.story.*;
import games.paths.core.repository.story.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link StoryReadAdapter}.
 * Verifies delegation to the correct JPA repositories.
 */
@ExtendWith(MockitoExtension.class)
class StoryReadAdapterTest {

    @Mock private StoryRepository storyRepository;
    @Mock private StoryDifficultyRepository difficultyRepository;
    @Mock private TextRepository textRepository;
    @Mock private LocationRepository locationRepository;
    @Mock private EventRepository eventRepository;
    @Mock private ItemRepository itemRepository;

    @InjectMocks
    private StoryReadAdapter adapter;

    @Nested
    @DisplayName("Find Stories")
    class FindStories {

        @Test
        @DisplayName("findStoriesByVisibility should delegate to repository")
        void findByVisibility() {
            StoryEntity s = new StoryEntity();
            s.setUuid("uuid-1");
            when(storyRepository.findByVisibilityOrderByPriorityDesc("PUBLIC"))
                    .thenReturn(List.of(s));

            List<StoryEntity> result = adapter.findStoriesByVisibility("PUBLIC");

            assertEquals(1, result.size());
            assertEquals("uuid-1", result.get(0).getUuid());
        }

        @Test
        @DisplayName("findAllStories should delegate to repository.findAll")
        void findAll() {
            when(storyRepository.findAll()).thenReturn(List.of(new StoryEntity(), new StoryEntity()));

            assertEquals(2, adapter.findAllStories().size());
        }

        @Test
        @DisplayName("findStoryByUuid should return Optional")
        void findByUuid_found() {
            StoryEntity s = new StoryEntity();
            s.setUuid("uuid-1");
            when(storyRepository.findByUuid("uuid-1")).thenReturn(Optional.of(s));

            assertTrue(adapter.findStoryByUuid("uuid-1").isPresent());
        }

        @Test
        @DisplayName("findStoryByUuid should return empty for unknown UUID")
        void findByUuid_notFound() {
            when(storyRepository.findByUuid("unknown")).thenReturn(Optional.empty());

            assertTrue(adapter.findStoryByUuid("unknown").isEmpty());
        }
    }

    @Nested
    @DisplayName("Find Sub-Entities")
    class FindSubEntities {

        @Test
        @DisplayName("findDifficultiesByStoryId should delegate to repository")
        void findDifficulties() {
            when(difficultyRepository.findByIdStory(1L))
                    .thenReturn(List.of(new StoryDifficultyEntity()));

            assertEquals(1, adapter.findDifficultiesByStoryId(1L).size());
        }

        @Test
        @DisplayName("findTextsByStoryAndIdText should delegate to repository")
        void findTextsByStoryAndIdText() {
            when(textRepository.findByIdStoryAndIdText(1L, 100))
                    .thenReturn(List.of(new TextEntity()));

            assertEquals(1, adapter.findTextsByStoryAndIdText(1L, 100).size());
        }

        @Test
        @DisplayName("findTextByStoryIdTextAndLang should return first match")
        void findTextByLang_found() {
            TextEntity t = new TextEntity();
            t.setShortText("Hello");
            when(textRepository.findByIdStoryAndIdTextAndLang(1L, 100, "en"))
                    .thenReturn(List.of(t));

            Optional<TextEntity> result = adapter.findTextByStoryIdTextAndLang(1L, 100, "en");

            assertTrue(result.isPresent());
            assertEquals("Hello", result.get().getShortText());
        }

        @Test
        @DisplayName("findTextByStoryIdTextAndLang should return empty when no match")
        void findTextByLang_notFound() {
            when(textRepository.findByIdStoryAndIdTextAndLang(1L, 100, "fr"))
                    .thenReturn(List.of());

            assertTrue(adapter.findTextByStoryIdTextAndLang(1L, 100, "fr").isEmpty());
        }
    }

    @Nested
    @DisplayName("Count Operations")
    class CountOperations {

        @Test
        @DisplayName("countLocationsByStoryId should return count")
        void countLocations() {
            when(locationRepository.findByIdStory(1L))
                    .thenReturn(List.of(new LocationEntity(), new LocationEntity()));

            assertEquals(2, adapter.countLocationsByStoryId(1L));
        }

        @Test
        @DisplayName("countEventsByStoryId should return count")
        void countEvents() {
            when(eventRepository.findByIdStory(1L))
                    .thenReturn(List.of(new EventEntity()));

            assertEquals(1, adapter.countEventsByStoryId(1L));
        }

        @Test
        @DisplayName("countItemsByStoryId should return count")
        void countItems() {
            when(itemRepository.findByIdStory(1L)).thenReturn(List.of());

            assertEquals(0, adapter.countItemsByStoryId(1L));
        }
    }
}
