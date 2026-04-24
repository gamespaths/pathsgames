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
    @Mock private CharacterTemplateRepository characterTemplateRepository;
    @Mock private ClassRepository classRepository;
    @Mock private TraitRepository traitRepository;
    @Mock private CardRepository cardRepository;
    @Mock private CreatorRepository creatorRepository;

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

    // === Step 15: Category/Group queries and new entity lookups ===

    @Nested
    @DisplayName("Category and Group Queries")
    class CategoryGroupQueries {

        @Test
        @DisplayName("findDistinctCategoriesByVisibility should delegate to repository")
        void findDistinctCategories() {
            when(storyRepository.findDistinctCategoriesByVisibility("PUBLIC"))
                    .thenReturn(List.of("adventure", "horror"));

            List<String> result = adapter.findDistinctCategoriesByVisibility("PUBLIC");

            assertEquals(2, result.size());
            assertEquals("adventure", result.get(0));
        }

        @Test
        @DisplayName("findDistinctGroupsByVisibility should delegate to repository")
        void findDistinctGroups() {
            when(storyRepository.findDistinctGroupsByVisibility("PUBLIC"))
                    .thenReturn(List.of("fantasy"));

            List<String> result = adapter.findDistinctGroupsByVisibility("PUBLIC");

            assertEquals(1, result.size());
            assertEquals("fantasy", result.get(0));
        }

        @Test
        @DisplayName("findStoriesByCategoryAndVisibility should delegate to repository")
        void findByCategory() {
            StoryEntity s = new StoryEntity();
            s.setUuid("uuid-1");
            when(storyRepository.findByCategoryAndVisibilityOrderByPriorityDesc("adventure", "PUBLIC"))
                    .thenReturn(List.of(s));

            List<StoryEntity> result = adapter.findStoriesByCategoryAndVisibility("adventure", "PUBLIC");

            assertEquals(1, result.size());
            assertEquals("uuid-1", result.get(0).getUuid());
        }

        @Test
        @DisplayName("findStoriesByGroupAndVisibility should delegate to repository")
        void findByGroup() {
            StoryEntity s = new StoryEntity();
            s.setUuid("uuid-2");
            when(storyRepository.findByGroupAndVisibilityOrderByPriorityDesc("fantasy", "PUBLIC"))
                    .thenReturn(List.of(s));

            List<StoryEntity> result = adapter.findStoriesByGroupAndVisibility("fantasy", "PUBLIC");

            assertEquals(1, result.size());
            assertEquals("uuid-2", result.get(0).getUuid());
        }
    }

    @Nested
    @DisplayName("Step 15 Entity Lookups")
    class Step15EntityLookups {

        @Test
        @DisplayName("findCharacterTemplatesByStoryId should delegate to repository")
        void findCharacterTemplates() {
            when(characterTemplateRepository.findByIdStory(1L))
                    .thenReturn(List.of(new CharacterTemplateEntity()));

            assertEquals(1, adapter.findCharacterTemplatesByStoryId(1L).size());
        }

        @Test
        @DisplayName("findClassesByStoryId should delegate to repository")
        void findClasses() {
            when(classRepository.findByIdStory(1L))
                    .thenReturn(List.of(new ClassEntity(), new ClassEntity()));

            assertEquals(2, adapter.findClassesByStoryId(1L).size());
        }

        @Test
        @DisplayName("findTraitsByStoryId should delegate to repository")
        void findTraits() {
            when(traitRepository.findByIdStory(1L))
                    .thenReturn(List.of(new TraitEntity()));

            assertEquals(1, adapter.findTraitsByStoryId(1L).size());
        }

        @Test
        @DisplayName("findCardByStoryIdAndCardId should return Optional when found")
        void findCard_found() {
            CardEntity c = new CardEntity();
            c.setUuid("card-uuid");
            when(cardRepository.findByIdStoryAndId(1L, 10L)).thenReturn(Optional.of(c));

            Optional<CardEntity> result = adapter.findCardByStoryIdAndCardId(1L, 10L);

            assertTrue(result.isPresent());
            assertEquals("card-uuid", result.get().getUuid());
        }

        @Test
        @DisplayName("findCardByStoryIdAndCardId should return empty when not found")
        void findCard_notFound() {
            when(cardRepository.findByIdStoryAndId(1L, 99L)).thenReturn(Optional.empty());

            assertTrue(adapter.findCardByStoryIdAndCardId(1L, 99L).isEmpty());
        }
    }

    // === Step 16: Card and Creator lookup by UUID ===

    @Nested
    @DisplayName("Step 16 Entity Lookups")
    class Step16EntityLookups {

        @Test
        @DisplayName("findCardByStoryIdAndUuid should return card when found")
        void findCardByUuid_found() {
            CardEntity c = new CardEntity();
            c.setUuid("card-uuid");
            when(cardRepository.findByIdStoryAndUuid(1L, "card-uuid")).thenReturn(Optional.of(c));

            Optional<CardEntity> result = adapter.findCardByStoryIdAndUuid(1L, "card-uuid");

            assertTrue(result.isPresent());
            assertEquals("card-uuid", result.get().getUuid());
        }

        @Test
        @DisplayName("findCardByStoryIdAndUuid should return empty when not found")
        void findCardByUuid_notFound() {
            when(cardRepository.findByIdStoryAndUuid(1L, "unknown")).thenReturn(Optional.empty());

            assertTrue(adapter.findCardByStoryIdAndUuid(1L, "unknown").isEmpty());
        }

        @Test
        @DisplayName("findCreatorByStoryIdAndUuid should return creator when found")
        void findCreatorByUuid_found() {
            CreatorEntity cr = new CreatorEntity();
            cr.setUuid("creator-uuid");
            when(creatorRepository.findByIdStoryAndUuid(1L, "creator-uuid")).thenReturn(Optional.of(cr));

            Optional<CreatorEntity> result = adapter.findCreatorByStoryIdAndUuid(1L, "creator-uuid");

            assertTrue(result.isPresent());
            assertEquals("creator-uuid", result.get().getUuid());
        }

        @Test
        @DisplayName("findCreatorByStoryIdAndUuid should return empty when not found")
        void findCreatorByUuid_notFound() {
            when(creatorRepository.findByIdStoryAndUuid(1L, "unknown")).thenReturn(Optional.empty());

            assertTrue(adapter.findCreatorByStoryIdAndUuid(1L, "unknown").isEmpty());
        }

        @Test
        @DisplayName("findCreatorsByStoryId should delegate to repository")
        void findCreatorsByStoryId() {
            when(creatorRepository.findByIdStory(1L))
                    .thenReturn(List.of(new CreatorEntity(), new CreatorEntity()));

            assertEquals(2, adapter.findCreatorsByStoryId(1L).size());
        }
    }

    // === Step 17: CRUD lookup methods ===

    @Nested
    @DisplayName("Step 17 CRUD Lookups")
    class Step17CrudLookups {

        @Test void findDifficultyByUuid() {
            when(difficultyRepository.findByIdStoryAndUuid(1L, "d-uuid")).thenReturn(Optional.of(new StoryDifficultyEntity()));
            assertTrue(adapter.findDifficultyByStoryIdAndUuid(1L, "d-uuid").isPresent());
        }

        @Test void findLocationByUuid() {
            when(locationRepository.findByIdStoryAndUuid(1L, "l-uuid")).thenReturn(Optional.of(new LocationEntity()));
            assertTrue(adapter.findLocationByStoryIdAndUuid(1L, "l-uuid").isPresent());
        }

        @Test void findLocationsByStoryId() {
            when(locationRepository.findByIdStory(1L)).thenReturn(List.of(new LocationEntity()));
            assertEquals(1, adapter.findLocationsByStoryId(1L).size());
        }

        @Test void findEventByUuid() {
            when(eventRepository.findByIdStoryAndUuid(1L, "e-uuid")).thenReturn(Optional.of(new EventEntity()));
            assertTrue(adapter.findEventByStoryIdAndUuid(1L, "e-uuid").isPresent());
        }

        @Test void findEventsByStoryId() {
            when(eventRepository.findByIdStory(1L)).thenReturn(List.of(new EventEntity()));
            assertEquals(1, adapter.findEventsByStoryId(1L).size());
        }

        @Test void findItemByUuid() {
            when(itemRepository.findByIdStoryAndUuid(1L, "i-uuid")).thenReturn(Optional.of(new ItemEntity()));
            assertTrue(adapter.findItemByStoryIdAndUuid(1L, "i-uuid").isPresent());
        }

        @Test void findItemsByStoryId() {
            when(itemRepository.findByIdStory(1L)).thenReturn(List.of(new ItemEntity()));
            assertEquals(1, adapter.findItemsByStoryId(1L).size());
        }

        @Test void findCharacterTemplateByUuid() {
            when(characterTemplateRepository.findByIdStoryAndUuid(1L, "ct-uuid")).thenReturn(Optional.of(new CharacterTemplateEntity()));
            assertTrue(adapter.findCharacterTemplateByStoryIdAndUuid(1L, "ct-uuid").isPresent());
        }

        @Test void findClassByUuid() {
            when(classRepository.findByIdStoryAndUuid(1L, "c-uuid")).thenReturn(Optional.of(new ClassEntity()));
            assertTrue(adapter.findClassByStoryIdAndUuid(1L, "c-uuid").isPresent());
        }

        @Test void findTraitByUuid() {
            when(traitRepository.findByIdStoryAndUuid(1L, "t-uuid")).thenReturn(Optional.of(new TraitEntity()));
            assertTrue(adapter.findTraitByStoryIdAndUuid(1L, "t-uuid").isPresent());
        }

        @Test void findTextByUuid() {
            when(textRepository.findByIdStoryAndUuid(1L, "tx-uuid")).thenReturn(Optional.of(new TextEntity()));
            assertTrue(adapter.findTextByStoryIdAndUuid(1L, "tx-uuid").isPresent());
        }

        @Test void findTextsByStoryId() {
            when(textRepository.findByIdStory(1L)).thenReturn(List.of(new TextEntity()));
            assertEquals(1, adapter.findTextsByStoryId(1L).size());
        }

        @Test void findCardsByStoryId() {
            when(cardRepository.findByIdStory(1L)).thenReturn(List.of(new CardEntity()));
            assertEquals(1, adapter.findCardsByStoryId(1L).size());
        }
    }
}
